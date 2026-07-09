import { Badge } from "@/components/ui/Badge";
import { statusTone } from "@/lib/constants/status";
import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
} & Pick<HTMLAttributes<HTMLSpanElement>, "className">) {
  return <Badge tone={statusTone(status)} className={cn(className)}>{label ?? status}</Badge>;
}
