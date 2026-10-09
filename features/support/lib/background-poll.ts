/** Aviso con el chat cerrado. El hilo abierto tiene otro intervalo. */
export const SUPPORT_BACKGROUND_POLL_MS = 25_000;

export function shouldPollSupportBackground(input: {
  cancelled: boolean;
  inFlight: boolean;
  visibilityState: "visible" | "hidden" | "prerender";
}): boolean {
  if (input.cancelled || input.inFlight) return false;
  if (input.visibilityState === "hidden") return false;
  return true;
}

type StaffMessage = { id: string; role: string; text: string };

export function latestNotifiableStaffMessage(
  messages: StaffMessage[],
): StaffMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "bot" && message.id !== "support-greeting") {
      return message;
    }
  }
  return null;
}

export type BackgroundStaffNotice =
  | { action: "ignore" }
  | { action: "seed"; messageId: string }
  | { action: "notify"; messageId: string; preview: string };

/**
 * La primera lectura solo anota el último mensaje.
 * El badge sale cuando llega otro id de staff.
 */
export function planBackgroundStaffNotice(input: {
  messages: StaffMessage[];
  seeded: boolean;
  lastSeenStaffMessageId: string | null;
  fallbackPreview: string;
}): BackgroundStaffNotice {
  const latest = latestNotifiableStaffMessage(input.messages);
  if (!latest) return { action: "ignore" };
  if (!input.seeded) return { action: "seed", messageId: latest.id };
  if (latest.id === input.lastSeenStaffMessageId) return { action: "ignore" };
  const preview = (latest.text || input.fallbackPreview).slice(0, 80);
  return { action: "notify", messageId: latest.id, preview };
}
