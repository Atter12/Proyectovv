import { createAdminClient } from "@/lib/supabase/admin";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import {
  COD_PIXEL_EVENT_DEFS,
  createTikTokPixel,
  createTikTokPixelEvents,
  listTikTokPixels,
  type TikTokPixelCategory,
  type TikTokPixelRecord,
} from "@/lib/integrations/tiktok/pixel.server";

export type StoredTikTokPixel = {
  id: string;
  organizationId: string;
  hecomClienteId: string;
  advertiserId: string;
  pixelId: string;
  pixelCode: string | null;
  name: string;
  status: string;
  pixelCategory: string | null;
  eventsJson: unknown;
  createdAt: string;
  updatedAt: string;
};

function mapStored(row: Record<string, unknown>): StoredTikTokPixel {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    hecomClienteId: String(row.hecom_cliente_id),
    advertiserId: String(row.advertiser_id),
    pixelId: String(row.pixel_id),
    pixelCode: row.pixel_code ? String(row.pixel_code) : null,
    name: String(row.name ?? ""),
    status: String(row.status ?? "active"),
    pixelCategory: row.pixel_category ? String(row.pixel_category) : null,
    eventsJson: row.events_json ?? [],
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

/**
 * Garantiza un organization_id que exista en `organizations` (FK de tiktok_pixels).
 * Si la membresía apunta a un id huérfano o inválido, recupera otra org del usuario
 * o crea una mínima.
 */
export async function resolveWritableOrganizationId(input: {
  preferredOrganizationId: string;
  userId: string;
}): Promise<string> {
  const admin = createAdminClient();
  const preferred = input.preferredOrganizationId.trim();

  async function orgExists(id: string): Promise<boolean> {
    if (!id) return false;
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("id", id)
      .maybeSingle<{ id: string }>();
    return Boolean(data?.id);
  }

  if (await orgExists(preferred)) return preferred;

  const { data: memberships } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", input.userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  for (const row of memberships ?? []) {
    const id = String(
      (row as { organization_id?: string }).organization_id ?? "",
    ).trim();
    if (id && id !== preferred && (await orgExists(id))) return id;
  }

  const slug = `holistic-pixels-${input.userId.replace(/-/g, "").slice(0, 10)}-${Date.now().toString(36)}`;
  const { data: created, error: createErr } = await admin
    .from("organizations")
    .insert({
      name: "Holistic · Píxeles",
      slug,
      created_by: input.userId,
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  if (createErr || !created?.id) {
    const fallback = await admin
      .from("organizations")
      .insert({ name: "Holistic · Píxeles", slug: `${slug}-b` })
      .select("id")
      .single<{ id: string }>();
    if (fallback.error || !fallback.data?.id) {
      throw new Error(
        createErr?.message ??
          fallback.error?.message ??
          "No hay organización válida para guardar el píxel.",
      );
    }
    await admin.from("organization_memberships").upsert(
      {
        organization_id: fallback.data.id,
        user_id: input.userId,
        role: "owner",
        status: "active",
      },
      { onConflict: "organization_id,user_id" },
    );
    return fallback.data.id;
  }

  await admin.from("organization_memberships").upsert(
    {
      organization_id: created.id,
      user_id: input.userId,
      role: "owner",
      status: "active",
    },
    { onConflict: "organization_id,user_id" },
  );

  return created.id;
}

export async function assertAdvertiserBelongsToCliente(input: {
  hecomClienteId: string;
  advertiserId: string;
  /** Solo cuentas activas / en uso (en campaña). */
  requireActive?: boolean;
}): Promise<{ advertiserId: string; accountName: string | null }> {
  const advertiserId = input.advertiserId.trim();
  const overview = await getHecomClienteAdAccountsOverview(
    input.hecomClienteId,
    "fast",
  );
  const match = overview.accounts.find(
    (a) => (a.externalAccountId ?? "").trim() === advertiserId,
  );
  if (!match) {
    throw new Error(
      "Esa cuenta ads no pertenece al cliente seleccionado.",
    );
  }
  if (input.requireActive && match.status !== "active") {
    throw new Error(
      "Solo se pueden operar cuentas en uso (activas / en campaña).",
    );
  }
  return { advertiserId, accountName: match.name ?? null };
}

export async function listStoredPixelsForCliente(input: {
  organizationId: string;
  hecomClienteId: string;
}): Promise<StoredTikTokPixel[]> {
  const admin = createAdminClient();
  // Scope principal: cliente Hecom. organization_id puede variar si se sanó la FK.
  const { data, error } = await admin
    .from("tiktok_pixels")
    .select("*")
    .eq("hecom_cliente_id", input.hecomClienteId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapStored(row as Record<string, unknown>));
}

export async function upsertStoredPixel(input: {
  organizationId: string;
  hecomClienteId: string;
  advertiserId: string;
  pixel: TikTokPixelRecord;
  createdBy: string;
  eventsJson?: unknown;
  metadata?: Record<string, unknown>;
}): Promise<StoredTikTokPixel> {
  const admin = createAdminClient();
  const organizationId = await resolveWritableOrganizationId({
    preferredOrganizationId: input.organizationId,
    userId: input.createdBy,
  });
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("tiktok_pixels")
    .upsert(
      {
        organization_id: organizationId,
        hecom_cliente_id: input.hecomClienteId,
        advertiser_id: input.advertiserId,
        pixel_id: input.pixel.pixelId,
        pixel_code: input.pixel.pixelCode,
        name: input.pixel.pixelName || `Pixel ${input.pixel.pixelId}`,
        status: "active",
        pixel_category: input.pixel.pixelCategory,
        events_json: input.eventsJson ?? [],
        metadata: input.metadata ?? {},
        created_by: input.createdBy,
        updated_at: now,
      },
      { onConflict: "advertiser_id,pixel_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar el píxel.");
  }
  return mapStored(data as Record<string, unknown>);
}

export async function syncPixelsFromTikTok(input: {
  organizationId: string;
  hecomClienteId: string;
  advertiserId: string;
  userId: string;
}): Promise<{
  remote: TikTokPixelRecord[];
  stored: StoredTikTokPixel[];
}> {
  await assertAdvertiserBelongsToCliente({
    hecomClienteId: input.hecomClienteId,
    advertiserId: input.advertiserId,
    requireActive: true,
  });

  const organizationId = await resolveWritableOrganizationId({
    preferredOrganizationId: input.organizationId,
    userId: input.userId,
  });

  const { pixels } = await listTikTokPixels({
    advertiserId: input.advertiserId,
    organizationId,
  });

  const stored: StoredTikTokPixel[] = [];
  for (const pixel of pixels) {
    stored.push(
      await upsertStoredPixel({
        organizationId,
        hecomClienteId: input.hecomClienteId,
        advertiserId: input.advertiserId,
        pixel,
        createdBy: input.userId,
        metadata: { synced_at: new Date().toISOString() },
      }),
    );
  }

  return { remote: pixels, stored };
}

export async function createPixelForCliente(input: {
  organizationId: string;
  hecomClienteId: string;
  advertiserId: string;
  pixelName: string;
  userId: string;
  pixelCategory?: TikTokPixelCategory;
  setupCodEvents?: boolean;
}): Promise<{
  pixel: StoredTikTokPixel;
  events: { applied: number; skipped: string[] } | null;
}> {
  const { advertiserId, accountName } = await assertAdvertiserBelongsToCliente({
    hecomClienteId: input.hecomClienteId,
    advertiserId: input.advertiserId,
    requireActive: true,
  });

  const organizationId = await resolveWritableOrganizationId({
    preferredOrganizationId: input.organizationId,
    userId: input.userId,
  });

  const name =
    input.pixelName.trim() ||
    `Holistic · ${accountName || advertiserId}`.slice(0, 80);

  const created = await createTikTokPixel({
    advertiserId,
    pixelName: name,
    pixelCategory: input.pixelCategory ?? "ONLINE_STORE",
    organizationId,
  });

  let eventsResult: { applied: number; skipped: string[] } | null = null;
  let eventsJson: unknown = [];

  if (input.setupCodEvents !== false) {
    try {
      const ev = await createTikTokPixelEvents({
        advertiserId,
        pixelId: created.pixelId,
        organizationId,
      });
      eventsResult = { applied: ev.applied, skipped: ev.skipped };
      eventsJson = COD_PIXEL_EVENT_DEFS.map((d) => d.name).filter(
        (n) => !ev.skipped.includes(n),
      );
    } catch (error) {
      eventsResult = {
        applied: 0,
        skipped: COD_PIXEL_EVENT_DEFS.map((d) => d.name),
      };
      eventsJson = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const pixel = await upsertStoredPixel({
    organizationId,
    hecomClienteId: input.hecomClienteId,
    advertiserId,
    pixel: created,
    createdBy: input.userId,
    eventsJson,
    metadata: {
      created_via: "ads_holistic",
      events_setup: eventsResult,
    },
  });

  return { pixel, events: eventsResult };
}

export async function setupCodEventsForStoredPixel(input: {
  organizationId: string;
  hecomClienteId: string;
  pixelRowId: string;
  userId: string;
}): Promise<{ applied: number; skipped: string[]; pixel: StoredTikTokPixel }> {
  const admin = createAdminClient();
  const organizationId = await resolveWritableOrganizationId({
    preferredOrganizationId: input.organizationId,
    userId: input.userId,
  });

  const { data, error } = await admin
    .from("tiktok_pixels")
    .select("*")
    .eq("id", input.pixelRowId)
    .eq("hecom_cliente_id", input.hecomClienteId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Píxel no encontrado.");
  }

  const stored = mapStored(data as Record<string, unknown>);
  await assertAdvertiserBelongsToCliente({
    hecomClienteId: input.hecomClienteId,
    advertiserId: stored.advertiserId,
    requireActive: true,
  });

  const ev = await createTikTokPixelEvents({
    advertiserId: stored.advertiserId,
    pixelId: stored.pixelId,
    organizationId,
  });

  const eventsJson = COD_PIXEL_EVENT_DEFS.map((d) => d.name).filter(
    (n) => !ev.skipped.includes(n),
  );

  const { data: updated, error: upErr } = await admin
    .from("tiktok_pixels")
    .update({
      events_json: eventsJson,
      metadata: {
        ...((data as { metadata?: Record<string, unknown> }).metadata ?? {}),
        events_setup: { applied: ev.applied, skipped: ev.skipped },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", stored.id)
    .select("*")
    .single();

  if (upErr || !updated) {
    throw new Error(upErr?.message ?? "No se pudo actualizar eventos.");
  }

  return {
    applied: ev.applied,
    skipped: ev.skipped,
    pixel: mapStored(updated as Record<string, unknown>),
  };
}
