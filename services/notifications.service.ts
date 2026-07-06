import { createClient } from "@/lib/supabase/server";
import { isRecord } from "@/lib/records";
import type { SessionUser } from "@/types/auth";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(
  session: SessionUser,
): Promise<NotificationItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("notifications")
    .select("id, title, body, type, data, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (session.organizationId) {
    query = query.or(
      `user_id.eq.${session.id},organization_id.eq.${session.organizationId}`,
    );
  } else {
    query = query.eq("user_id", session.id);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type ?? "info",
    data: isRecord(row.data) ? row.data : {},
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}

export async function markNotificationRead(
  session: SessionUser,
  notificationId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .or(
      session.organizationId
        ? `user_id.eq.${session.id},organization_id.eq.${session.organizationId}`
        : `user_id.eq.${session.id}`,
    );

  if (error) {
    throw new Error(error.message);
  }
}
