import { createAdminClient } from "@/lib/supabase/admin";

interface CreateNotificationInput {
  organizationId?: string | null;
  userId?: string | null;
  title: string;
  body?: string | null;
  type?: string;
  data?: Record<string, unknown>;
}

export async function createNotificationBestEffort(
  input: CreateNotificationInput,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      organization_id: input.organizationId ?? null,
      user_id: input.userId ?? null,
      title: input.title,
      body: input.body ?? null,
      type: input.type ?? "info",
      data: input.data ?? {},
    });
  } catch (error) {
    console.error("[notifications] no se pudo crear la notificación", error);
  }
}
