import { Card } from "@/components/ui/Card";

export default function Loading() {
  return (
    <div className="grid gap-4">
      <div className="h-10 w-72 animate-pulse rounded-2xl bg-[var(--admin-border)]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="h-32 animate-pulse bg-[var(--admin-surface)]/70" />
        ))}
      </div>
      <Card className="h-96 animate-pulse bg-[var(--admin-surface)]/70" />
    </div>
  );
}
