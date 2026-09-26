import "server-only";
import {
  planAllianceAlerts,
  type FollowupAlliance,
  type FollowupReminder,
  type PlannedReminder,
} from "@/features/alliances/lib/followup";
import { createAdminClient } from "@/lib/supabase/admin";

export async function applyAllianceFollowups(
  alliances: FollowupAlliance[],
  today: string,
): Promise<{ created: { allianceId: string; reminder: FollowupReminder }[]; closedKeys: string[]; blocked: boolean }> {
  const plan = planAllianceAlerts(alliances, today);
  if (plan.create.length === 0 && plan.completeKeys.length === 0) return { created: [], closedKeys: [], blocked: false };

  try {
    const admin = createAdminClient();
    const created: { allianceId: string; reminder: FollowupReminder }[] = [];
    if (plan.create.length > 0) {
      const inserted = await admin
        .from("alliance_reminders")
        .insert(plan.create.map(reminderRow))
        .select("id, title, due_on, priority, owner_name, source_key");
      if (inserted.error) {
        if (isMissingSourceKey(inserted.error)) return { created: [], closedKeys: [], blocked: true };
        for (const reminder of plan.create) {
          const single = await admin
            .from("alliance_reminders")
            .insert(reminderRow(reminder))
            .select("id, title, due_on, priority, owner_name, source_key")
            .maybeSingle();
          if (!single.error && single.data) created.push({ allianceId: reminder.allianceId, reminder: mapInserted(single.data) });
        }
      } else {
        for (const row of inserted.data ?? []) {
          const source = plan.create.find((item) => item.sourceKey === String(row.source_key ?? ""));
          if (!source) continue;
          created.push({ allianceId: source.allianceId, reminder: mapInserted(row) });
        }
      }
    }

    if (plan.completeKeys.length > 0) {
      const closed = await admin
        .from("alliance_reminders")
        .update({ status: "done" })
        .in("source_key", plan.completeKeys)
        .eq("status", "open");
      if (closed.error && isMissingSourceKey(closed.error)) return { created, closedKeys: [], blocked: true };
      if (closed.error) return { created, closedKeys: [], blocked: false };
    }

    return { created, closedKeys: plan.completeKeys, blocked: false };
  } catch {
    return { created: [], closedKeys: [], blocked: false };
  }
}

function reminderRow(reminder: PlannedReminder) {
  return {
    alliance_id: reminder.allianceId,
    title: reminder.title,
    due_on: reminder.dueOn,
    priority: reminder.priority,
    status: "open",
    owner_name: reminder.ownerName || null,
    notes: reminder.notes,
    source_key: reminder.sourceKey,
  };
}

function mapInserted(row: {
  id: string;
  title: string;
  due_on: string;
  priority: string;
  owner_name: string | null;
  source_key: string | null;
}): FollowupReminder {
  return {
    id: row.id,
    title: row.title,
    dueOn: row.due_on,
    priority: row.priority === "low" || row.priority === "high" ? row.priority : "normal",
    status: "open",
    ownerName: row.owner_name ?? "",
    sourceKey: row.source_key ?? "",
  };
}

function isMissingSourceKey(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "42703" || error.code === "PGRST204" || message.includes("source_key") || message.includes("column");
}
