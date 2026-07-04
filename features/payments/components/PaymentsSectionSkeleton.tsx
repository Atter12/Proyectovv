export function PaymentsSectionSkeleton({ rows = 1 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-32 rounded-2xl border border-[#e5e7eb] bg-white"
        />
      ))}
    </div>
  );
}

export function PaymentsStatsSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-24 rounded-2xl border border-[#e5e7eb] bg-white"
        />
      ))}
    </div>
  );
}

export function PaymentsTabContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4 sm:p-6">
      <div className="h-10 rounded-xl bg-slate-100" />
      <div className="h-48 rounded-xl bg-slate-100" />
    </div>
  );
}
