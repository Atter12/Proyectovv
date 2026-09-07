import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  createPixelForCliente,
  listStoredPixelsForCliente,
  syncPixelsFromTikTok,
} from "@/lib/pixels/tiktok-pixels.server";
import { TikTokPixelApiError } from "@/lib/integrations/tiktok/pixel.server";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await requirePermission("adAccounts:read");
  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Seleccioná un cliente primero." },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const syncAdvertiser = url.searchParams.get("syncAdvertiser")?.trim() || "";

  try {
    if (syncAdvertiser) {
      const synced = await syncPixelsFromTikTok({
        organizationId: session.organizationId,
        hecomClienteId: selected.id,
        advertiserId: syncAdvertiser,
        userId: session.id,
      });
      return NextResponse.json({
        ok: true,
        pixels: synced.stored,
        remoteCount: synced.remote.length,
      });
    }

    const [pixels, overview] = await Promise.all([
      listStoredPixelsForCliente({
        organizationId: session.organizationId,
        hecomClienteId: selected.id,
      }),
      getHecomClienteAdAccountsOverview(selected.id, "fast"),
    ]);

    return NextResponse.json({
      ok: true,
      pixels,
      accounts: overview.accounts
        .filter(
          (a) =>
            a.externalAccountId?.trim() &&
            a.status === "active",
        )
        .map((a) => ({
          id: a.id,
          name: a.name,
          advertiserId: a.externalAccountId!.trim(),
          status: a.status,
        })),
      cliente: { id: selected.id, name: selected.name },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al listar píxeles.";
    const status = error instanceof TikTokPixelApiError ? 502 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const session = await requirePermission("adAccounts:create");
  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Seleccioná un cliente primero." },
      { status: 400 },
    );
  }

  let body: {
    advertiserId?: string;
    advertiserIds?: string[];
    pixelName?: string;
    setupCodEvents?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const fromArray = Array.isArray(body.advertiserIds)
    ? body.advertiserIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)
    : [];
  const single =
    typeof body.advertiserId === "string" ? body.advertiserId.trim() : "";
  const advertiserIds = [...new Set(fromArray.length > 0 ? fromArray : single ? [single] : [])];

  if (advertiserIds.length === 0) {
    return NextResponse.json(
      { error: "Seleccioná al menos una cuenta ads." },
      { status: 400 },
    );
  }

  try {
    const created: Awaited<
      ReturnType<typeof createPixelForCliente>
    >["pixel"][] = [];
    const failures: { advertiserId: string; error: string }[] = [];
    const baseName =
      typeof body.pixelName === "string" ? body.pixelName.trim() : "";
    const setupCodEvents = body.setupCodEvents === true;

    for (const advertiserId of advertiserIds) {
      try {
        const result = await createPixelForCliente({
          organizationId: session.organizationId,
          hecomClienteId: selected.id,
          advertiserId,
          pixelName:
            advertiserIds.length > 1 && baseName
              ? `${baseName} · ${advertiserId.slice(-6)}`
              : baseName,
          userId: session.id,
          setupCodEvents,
        });
        created.push(result.pixel);
      } catch (error) {
        failures.push({
          advertiserId,
          error:
            error instanceof Error ? error.message : "No se pudo crear el píxel.",
        });
      }
    }

    if (created.length === 0) {
      const first = failures[0];
      return NextResponse.json(
        {
          error:
            first?.error ||
            "No se pudo crear el píxel en ninguna cuenta seleccionada.",
          failures,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      pixel: created[0],
      pixels: created,
      createdCount: created.length,
      requestedCount: advertiserIds.length,
      failures,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear el píxel.";
    const status = error instanceof TikTokPixelApiError ? 502 : 400;
    return NextResponse.json(
      {
        error: message,
        tiktokCode:
          error instanceof TikTokPixelApiError ? error.tiktokCode : null,
        requestId:
          error instanceof TikTokPixelApiError ? error.requestId : null,
      },
      { status },
    );
  }
}
