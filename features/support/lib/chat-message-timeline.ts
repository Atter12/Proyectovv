import type { ChatMessage } from "@/features/support/types/support.types";
import {
  formatSupportChatDaySeparator,
  supportChatDayKey,
} from "@/lib/support/chat-time";

export type ChatTimelineItem =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; message: ChatMessage };

export function buildChatTimeline(messages: ChatMessage[]): ChatTimelineItem[] {
  const items: ChatTimelineItem[] = [];
  let lastDay: string | null = null;

  for (const message of messages) {
    const dayKey = supportChatDayKey(message.createdAt);
    if (dayKey && dayKey !== lastDay) {
      items.push({
        kind: "day",
        key: `day-${dayKey}`,
        label: formatSupportChatDaySeparator(message.createdAt!),
      });
      lastDay = dayKey;
    }
    items.push({ kind: "message", message });
  }

  return items;
}
