import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  ALLIANCE_STATUS_LABEL,
  ALLIANCE_TYPE_LABEL,
  CONTRACT_STATUS_LABEL,
  type AllianceStatus,
  type AllianceType,
  type ContractStatus,
} from "@/features/alliances/lib/domain";

const STATUS_TONE: Record<AllianceStatus, BadgeTone> = {
  active: "success",
  negotiating: "warning",
  paused: "neutral",
  ended: "info",
};

const CONTRACT_TONE: Record<ContractStatus, BadgeTone> = {
  signed: "success",
  renewed: "success",
  expiring: "warning",
  pending_signature: "warning",
  in_review: "info",
  draft: "neutral",
  expired: "danger",
};

export function AllianceTypeBadge({ type }: { type: AllianceType }) {
  return <Badge tone="purple">{ALLIANCE_TYPE_LABEL[type]}</Badge>;
}

export function AllianceStatusBadge({ status }: { status: AllianceStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{ALLIANCE_STATUS_LABEL[status]}</Badge>;
}

export function ContractStatusBadge({ status }: { status: ContractStatus | null }) {
  if (!status) return <Badge tone="neutral">Sin contrato</Badge>;
  return <Badge tone={CONTRACT_TONE[status]}>{CONTRACT_STATUS_LABEL[status]}</Badge>;
}
