import "server-only";
import webpush from "web-push";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

const PUSH_TYPES = new Set([
  "payment_approved",
  "payment_rejected",
  "payment_proof_uploaded",
  "payment_bank_confirmed",
]);

type PushPayload = {
  title: string;
  body?: string | null;
  url?: string | null;
};

function vapidReady(): boolean {
  return Boolean(serverEnv.vapidPublicKey && serverEnv.vapidPrivateKey);
}

function ensureVapid(): boolean {
  if (!vapidReady()) return false;
  webpush.setVapidDetails(
    "mailto:soporte@adsholistic.com",
    serverEnv.vapidPublicKey,
    serverEnv.vapidPrivateKey,
  );
  return true;
}

async function deliver(userIds: string[], payload: PushPayload): Promise<void> {
  if (!ensureVapid() || userIds.length === 0) return;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error || !data?.length) return;

  const dead: string[] = [];
  await Promise.all(
    data.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body ?? "",
            url: payload.url || "/overview",
          }),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(row.id);
        else console.error("[web-push] envío falló", status ?? err);
      }
    }),
  );

  if (dead.length > 0) {
    await admin.from("web_push_subscriptions").delete().in("id", dead);
  }
}

export async function sendWebPushToUsers(
  userIds: Array<string | null | undefined>,
  payload: PushPayload,
): Promise<void> {
  const ids = [...new Set(userIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  try {
    await deliver(ids, payload);
  } catch (error) {
    console.error("[web-push] no se pudo enviar", error);
  }
}

export async function sendWebPushToEmails(
  emails: string[],
  payload: PushPayload,
): Promise<void> {
  const list = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (list.length === 0 || !vapidReady()) return;
  try {
    const admin = createAdminClient();
    const orFilter = list.map((email) => `email.ilike.${email}`).join(",");
    const { data, error } = await admin.from("profiles").select("id, email").or(orFilter);
    if (error) {
      console.error("[web-push] no se pudieron resolver gerentes", error);
      return;
    }
    await deliver(
      (data ?? []).map((row) => String(row.id)),
      payload,
    );
  } catch (error) {
    console.error("[web-push] gerentes", error);
  }
}

export async function maybePushForNotification(input: {
  userId?: string | null;
  title: string;
  body?: string | null;
  type?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (!input.userId || !input.type || !PUSH_TYPES.has(input.type)) return;
  const url = typeof input.data?.url === "string" ? input.data.url : "/payments";
  await sendWebPushToUsers([input.userId], {
    title: input.title,
    body: input.body,
    url,
  });
}
