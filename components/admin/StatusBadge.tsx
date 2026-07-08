import { Badge } from "@/components/ui/Badge";
import { statusTone } from "@/lib/constants/status";

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? status}</Badge>;
}
