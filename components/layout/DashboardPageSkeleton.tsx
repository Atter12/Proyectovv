export function DashboardPageSkeleton() {
  return (
    <div className="min-w-0 animate-pulse space-y-5 sm:space-y-6 lg:space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-lg bg-slate-200 sm:w-48" />
        <div className="h-4 max-w-2xl rounded bg-slate-100" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-2xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card)]"
          />
        ))}
      </div>

      <div className="h-64 rounded-2xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card)] sm:h-72" />
    </div>
  );
}
