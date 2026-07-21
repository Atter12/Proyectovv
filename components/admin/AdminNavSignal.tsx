export function AdminNavSignal({ count, title }: { count: number; title: string }) {
  if (count <= 0) return null;

  const display = count > 9 ? "9+" : String(count);

  return (
    <span
      title={title}
      className="inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-[var(--admin-accent)] px-1.5 text-[0.65rem] font-semibold tabular-nums leading-none text-white"
    >
      {display}
    </span>
  );
}
