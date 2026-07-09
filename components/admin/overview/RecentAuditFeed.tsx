import Link from "next/link";
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
      <div className="rounded-xl border border-dashed border-[#cfe8ee] bg-white/45 px-3 py-5 text-center text-xs font-bold text-[#789bad]">
        Sin actividad auditada reciente.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#e8f2f6] rounded-xl border border-[#e1edf2] bg-white/55">
      {visibleItems.map(({ row, organization, actor }) => (
        <div key={row.id} className="flex gap-2 px-3 py-2.5">
          <span className="mt-0.5 h-8 w-0.5 shrink-0 rounded-full bg-[#74d3b4]" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-xs font-black text-[#061925]" title={row.action}>
                {row.action}
              </p>
              <time className="shrink-0 text-[0.62rem] font-bold text-[#789bad]">{formatDateTime(row.created_at)}</time>
            </div>
            <p
              className="mt-0.5 truncate text-[0.68rem] font-semibold text-[#587080]"
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
    <Link
      href="/admin/audit"
      className="shrink-0 rounded-full border border-[#cfe8ee] bg-white/70 px-3 py-1.5 text-xs font-black text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#effff7]"
    >
      Ver todo
    </Link>
  );
}
