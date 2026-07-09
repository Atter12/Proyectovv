export function AdminNavSignal({ count, title }: { count: number; title: string }) {
  if (count <= 0) return null;

  const display = count > 9 ? "9+" : String(count);

  return (
    <span
      title={title}
      className="inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-[#f4c95d]/16 px-1 text-[0.625rem] font-semibold tabular-nums leading-none text-[#f0d078] ring-1 ring-[#f4c95d]/22"
    >
      {display}
    </span>
  );
}
