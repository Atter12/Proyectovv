import type {
  AdvisorSchedule,
  MeetingStatus,
  MeetingType,
} from "@/features/support/lib/meeting-slots";

export type MeetingDto = {
  id: string;
  subject: string;
  notes: string | null;
  meetingType: MeetingType;
  channel: string;
  meetUrl: string | null;
  startsAt: string;
  endsAt: string;
  status: MeetingStatus;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  advisorName: string | null;
  advisorEmail: string | null;
  clientReminderSent: boolean;
  advisorReminderSent: boolean;
  createdAt: string;
};

export type ScheduleDto = AdvisorSchedule & { userId: string | null };

export type MeetingCounts = {
  today: number;
  pending: number;
  advisorsAvailable: number;
  advisorsTotal: number;
  next24h: number;
  attention: number;
};
