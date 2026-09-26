import type { MeetingStatus } from "@/features/support/lib/meeting-slots";

/** Estado con el que nace una cita pedida por el cliente. */
export const CREATED_MEETING_STATUS = "pending" as const;

const ACTIVE = new Set<string>(["pending", "confirmed", "rescheduled"]);

export class MeetingFlowError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function isClosedStatus(status: string): boolean {
  return status === "completed" || status === "cancelled" || status === "no_show";
}

export function occupiesSlot(status: string): boolean {
  return ACTIVE.has(status);
}

export type ClientPlan = {
  status: "cancelled" | "pending";
  clearMeetUrl: boolean;
  clearReminders: boolean;
};

/** Qué guarda el cliente al cancelar o reprogramar. */
export function planClientMutation(input: {
  status: string;
  startsAtMs: number;
  action: string;
  now?: number;
}): ClientPlan {
  const now = input.now ?? Date.now();
  if (!ACTIVE.has(input.status)) {
    throw new MeetingFlowError("terminal", "Esta reunión ya no se puede cambiar.");
  }
  if (input.startsAtMs <= now) {
    throw new MeetingFlowError("started", "Esta reunión ya comenzó.");
  }
  if (input.action === "cancel") {
    return { status: "cancelled", clearMeetUrl: false, clearReminders: false };
  }
  if (input.action === "reschedule") {
    return { status: "pending", clearMeetUrl: true, clearReminders: true };
  }
  throw new MeetingFlowError("invalid", "Acción no disponible.");
}

export type StaffPlan =
  | { kind: "schedule"; status: "confirmed" | "rescheduled" }
  | { kind: "close"; status: "completed" | "cancelled" | "no_show" }
  | { kind: "remind" }
  | { kind: "notes" };

/** Qué guarda soporte al confirmar, mover, cerrar o anotar. */
export function planStaffMutation(input: {
  status: string;
  action: string;
  hasMeetUrl: boolean;
}): StaffPlan {
  if (isClosedStatus(input.status) && input.action !== "notes") {
    throw new MeetingFlowError("terminal", "Esta reunión ya está cerrada.");
  }
  if (input.action === "confirm" || input.action === "reschedule") {
    if (!input.hasMeetUrl) {
      throw new MeetingFlowError("meet_url", "Pega un enlace https de la reunión.");
    }
    return {
      kind: "schedule",
      status: input.action === "confirm" ? "confirmed" : "rescheduled",
    };
  }
  if (input.action === "complete" || input.action === "no_show" || input.action === "cancel") {
    const status: MeetingStatus =
      input.action === "complete" ? "completed" : input.action === "no_show" ? "no_show" : "cancelled";
    return { kind: "close", status };
  }
  if (input.action === "remind") return { kind: "remind" };
  if (input.action === "notes") return { kind: "notes" };
  throw new MeetingFlowError("invalid", "Acción no disponible.");
}
