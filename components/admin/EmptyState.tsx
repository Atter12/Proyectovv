import { Card } from "@/components/ui/Card";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-8 text-center">
      <p className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f6f8] text-xl font-black text-[#789bad]">∅</p>
      <h2 className="mt-4 text-lg font-black text-[#061925]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#5d7280]">{description}</p>
    </Card>
  );
}
