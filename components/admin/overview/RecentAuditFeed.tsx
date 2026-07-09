import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";

type AuditFeedItem = {
  row: {
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
  };
  organization?: { name: string } | null;
  actor?: { email: string | null } | null;
};

const MAX_AUDIT_ITEMS = 5;

export function RecentAuditFeed({ items }: { items: AuditFeedItem[] }) {
  const visibleItems = items.slice(0, MAX_AUDIT_ITEMS);

  if (visibleItems.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-xs font-medium text-slate-500">
        Sin actividad auditada reciente.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {visibleItems.map(({ row, organization, actor }) => (
        <div key={row.id} className="flex gap-2 px-3 py-2.5">
          <span className="mt-0.5 h-8 w-0.5 shrink-0 rounded-full bg-[#178BFF]" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-xs font-medium text-slate-900" title={row.action}>
                {row.action}
              </p>
              <time className="shrink-0 text-[0.62rem] text-slate-500">{formatDateTime(row.created_at)}</time>
            </div>
            <p
              className="mt-0.5 truncate text-[0.68rem] text-slate-500"
              title={`${organization?.name ?? "Sistema"} · ${actor?.email ?? "Backend/service role"} · ${row.entity_type}`}
            >
              {organization?.name ?? "Sistema"} · {actor?.email ?? "Backend/service role"} · {row.entity_type}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecentAuditFeedHeaderLink() {
  return (
    <Link href="/admin/audit" className={buttonClass("outline", "sm")}>
      Ver todo
    </Link>
  );
}
