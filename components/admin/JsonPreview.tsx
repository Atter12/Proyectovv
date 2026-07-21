import { Card } from "@/components/ui/Card";

export function JsonPreview({ title, value }: { title: string; value: unknown }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-[var(--admin-text)]">{title}</h2>
      <pre className="mt-3 max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100 scrollbar-thin">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </Card>
  );
}
