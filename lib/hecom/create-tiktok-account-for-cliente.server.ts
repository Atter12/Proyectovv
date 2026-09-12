import "server-only";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import {
  countHecomTikTokAccountsForCliente,
  linkTikTokCuentaToHecomCliente,
} from "@/lib/hecom/link-tiktok-cuenta.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { syncApprovedAdAccountsForCliente } from "@/lib/hecom/sync-approved-ad-accounts.server";
import { createBcAdvertiserForCliente } from "@/lib/integrations/tiktok/bc-advertiser-create.server";
import {
  buildHolisticWhatsAppUrl,
  DEFAULT_TIKTOK_CREATE_BM,
  getTikTokBcCreateProfile,
  TIKTOK_SELF_SERVE_ACCOUNT_LIMIT,
  type TikTokCreateBmBucket,
} from "@/lib/integrations/tiktok/bc-create-profiles";
import { ensureAdvertisersInOrganizationForAllocation } from "@/services/payments.service";

export type CreateTikTokAccountForClienteResult =
  | {
      ok: true;
      needWhatsApp: false;
      advertiserId: string;
      advertiserName: string;
      bmBucket: TikTokCreateBmBucket;
      bcId: string;
      hecomLinked: boolean;
      syncedToOrg: boolean;
      organizationId: string | null;
      tiktokRequestId: string | null;
      accountCountAfter: number;
    }
  | {
      ok: false;
      needWhatsApp: true;
      accountCount: number;
      limit: number;
      whatsappUrl: string;
      message: string;
    };

/**
 * Transacción producto: TikTok create → Hecom map → sync Holistic org.
 * Cap self-serve: 2 cuentas / cliente (más → WhatsApp).
 */
export async function createTikTokAccountForCliente(input: {
  hecomClienteId: string;
  userId?: string | null;
  bmBucket?: string | null;
}): Promise<CreateTikTokAccountForClienteResult> {
  const clienteId = input.hecomClienteId.trim();
  if (!clienteId) throw new Error("Falta el cliente Hecom.");

  const cliente = await getHecomCliente(clienteId);
  if (!cliente) throw new Error("Cliente Hecom no encontrado.");

  const existingCount = await countHecomTikTokAccountsForCliente(clienteId);
  if (existingCount >= TIKTOK_SELF_SERVE_ACCOUNT_LIMIT) {
    const prefill =
      `Hola Holistic, soy ${cliente.name}. Ya tengo ${existingCount} cuentas TikTok en Ads Holistic y necesito crear una más (límite self-serve: ${TIKTOK_SELF_SERVE_ACCOUNT_LIMIT}).`;
    return {
      ok: false,
      needWhatsApp: true,
      accountCount: existingCount,
      limit: TIKTOK_SELF_SERVE_ACCOUNT_LIMIT,
      whatsappUrl: buildHolisticWhatsAppUrl(prefill),
      message: `Podés crear hasta ${TIKTOK_SELF_SERVE_ACCOUNT_LIMIT} cuentas desde la app. Para más, escribinos por WhatsApp.`,
    };
  }

  const profile = getTikTokBcCreateProfile(
    input.bmBucket ?? DEFAULT_TIKTOK_CREATE_BM,
  );
  const organizationId = await resolveOrganizationIdForHecomCliente(clienteId);

  let created: Awaited<ReturnType<typeof createBcAdvertiserForCliente>>;
  try {
    created = await createBcAdvertiserForCliente({
      clienteName: cliente.name,
      bmBucket: profile.bmBucket,
      organizationId: organizationId ?? undefined,
      sequence: existingCount + 1,
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "unknown";
    if (/TIKTOK_BC_UNUSUAL_ACTIVITY|unusual activity/i.test(raw)) {
      const clientMessage = raw
        .replace(/^TIKTOK_BC_UNUSUAL_ACTIVITY:\s*/i, "")
        .trim();
      const prefill =
        `Hola Holistic, soy ${cliente.name}. No puedo crear cuenta TikTok: TikTok API 40002 unusual activity en BM 300 (BC ${profile.bcId}). ¿Pueden escalarlo?`;
      return {
        ok: false,
        needWhatsApp: true,
        accountCount: existingCount,
        limit: TIKTOK_SELF_SERVE_ACCOUNT_LIMIT,
        whatsappUrl: buildHolisticWhatsAppUrl(prefill),
        message:
          clientMessage ||
          "TikTok rechazó el alta (API 40002 · unusual activity). Escribinos por WhatsApp para escalarlo con TikTok.",
      };
    }
    throw error;
  }

  let hecomLinked = false;
  try {
    await linkTikTokCuentaToHecomCliente({
      clientId: clienteId,
      advertiserId: created.advertiserId,
      advertiserName: created.advertiserName,
      bmBucket: created.bmBucket,
      fee: Number(created.bmBucket),
    });
    hecomLinked = true;
  } catch (error) {
    console.error("[hecom] create_tiktok_link_failed_after_tiktok_ok", {
      advertiserId: created.advertiserId,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw new Error(
      `La cuenta se creó en TikTok (${created.advertiserId}) pero no se pudo mapear en Hecom. Pedile a soporte que la vincule.`,
    );
  }

  let syncedToOrg = false;
  if (organizationId) {
    try {
      await syncApprovedAdAccountsForCliente({
        organizationId,
        clienteId,
        userId: input.userId ?? null,
        forceRefresh: true,
      });
      await ensureAdvertisersInOrganizationForAllocation({
        organizationId,
        clienteId,
        clienteName: cliente.name,
        userId: input.userId ?? null,
        advertisers: [
          {
            advertiserId: created.advertiserId,
            name: created.advertiserName,
            status: "active",
          },
        ],
      });
      syncedToOrg = true;
    } catch (error) {
      console.warn("[hecom] create_tiktok_sync_org_partial", {
        advertiserId: created.advertiserId,
        organizationId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return {
    ok: true,
    needWhatsApp: false,
    advertiserId: created.advertiserId,
    advertiserName: created.advertiserName,
    bmBucket: created.bmBucket,
    bcId: created.bcId,
    hecomLinked,
    syncedToOrg,
    organizationId,
    tiktokRequestId: created.tiktokRequestId,
    accountCountAfter: existingCount + 1,
  };
}
