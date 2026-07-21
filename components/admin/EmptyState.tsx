import { Card } from "@/components/ui/Card";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-8 text-center">
      <p className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--admin-accent-soft)] text-xl font-semibold text-[var(--admin-text-muted)]">∅</p>
      <h2 className="mt-4 text-lg font-semibold text-[var(--admin-text)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--admin-text-muted)]">{description}</p>
    </Card>
  );
}
