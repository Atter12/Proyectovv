import "server-only";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  DEFAULT_DEPOSIT_FEE_PERCENT,
  depositFromDesiredCredit,
  normalizeFeePercent,
  type DepositFeeBreakdown,
} from "@/lib/payments/deposit-fee";

export type ResolvedHecomDepositFee = DepositFeeBreakdown & {
  hecomClienteId: string | null;
  hecomClienteName: string | null;
  feeSource: "hecom_cliente" | "hecom_account" | "default";
};

/**
 * Prioridad: tiktok_default_fee del cliente → fee de alguna cuenta TikTok → default 10%.
 */
export function resolveFeePercentFromHecomCliente(input: {
  tiktokDefaultFee: number | null;
  accountFees: Array<number | null | undefined>;
}): { feePercent: number; feeSource: ResolvedHecomDepositFee["feeSource"] } {
  const fromCliente = normalizeFeePercent(input.tiktokDefaultFee);
  if (fromCliente != null) {
    return { feePercent: fromCliente, feeSource: "hecom_cliente" };
  }

  for (const raw of input.accountFees) {
    const fromAccount = normalizeFeePercent(raw ?? null);
    if (fromAccount != null) {
      return { feePercent: fromAccount, feeSource: "hecom_account" };
    }
  }

  return {
    feePercent: DEFAULT_DEPOSIT_FEE_PERCENT,
    feeSource: "default",
  };
}

/**
 * `creditCents` = lo que el cliente quiere en cartera.
 * Devuelve bruto a cobrar + fee Hecom.
 */
export async function resolveDepositFeeForSession(input: {
  userId: string;
  creditCents: number;
  hecomClienteId?: string | null;
}): Promise<ResolvedHecomDepositFee> {
  const selected =
    input.hecomClienteId != null && input.hecomClienteId.trim()
      ? { id: input.hecomClienteId.trim(), name: null as string | null }
      : await getSelectedHecomCliente(input.userId);

  if (!selected?.id) {
    const split = depositFromDesiredCredit(
      input.creditCents,
      DEFAULT_DEPOSIT_FEE_PERCENT,
    );
    return {
      ...split,
      hecomClienteId: null,
      hecomClienteName: null,
      feeSource: "default",
    };
  }

  const cliente = await getHecomCliente(selected.id);
  const { feePercent, feeSource } = resolveFeePercentFromHecomCliente({
    tiktokDefaultFee: cliente?.tiktokDefaultFee ?? null,
    accountFees: (cliente?.tiktokAccounts ?? []).map((a) => a.fee),
  });

  const split = depositFromDesiredCredit(input.creditCents, feePercent);

  return {
    ...split,
    hecomClienteId: selected.id,
    hecomClienteName:
      ("name" in selected && selected.name) || cliente?.name || null,
    feeSource,
  };
}

export async function getDepositFeePreviewForSession(input: {
  userId: string;
  hecomClienteId?: string | null;
}): Promise<{
  feePercent: number;
  feeSource: ResolvedHecomDepositFee["feeSource"];
  hecomClienteId: string | null;
  hecomClienteName: string | null;
}> {
  const resolved = await resolveDepositFeeForSession({
    userId: input.userId,
    creditCents: 10_000,
    hecomClienteId: input.hecomClienteId,
  });

  return {
    feePercent: resolved.feePercent,
    feeSource: resolved.feeSource,
    hecomClienteId: resolved.hecomClienteId,
    hecomClienteName: resolved.hecomClienteName,
  };
}
