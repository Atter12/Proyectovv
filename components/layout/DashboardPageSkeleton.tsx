export function DashboardPageSkeleton() {
  return (
    <div className="min-w-0 animate-pulse space-y-5 sm:space-y-6">
      <div className="dashboard-surface-card rounded-[1rem] p-5 sm:p-6">
        <div className="h-3 w-24 rounded bg-[#ece7e0]" />
        <div className="mt-3 h-7 w-56 max-w-full rounded bg-[#ece7e0]" />
        <div className="mt-2 h-4 w-full max-w-md rounded bg-[#f3eee8]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[88px] rounded-[1rem] border border-[#ece7e0] bg-white"
          />
        ))}
      </div>

      <div className="h-56 rounded-[1rem] border border-[#ece7e0] bg-white sm:h-72" />
    </div>
  );
}
