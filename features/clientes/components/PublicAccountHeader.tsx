import Image from "next/image";

export function PublicAccountHeader({ clientName, monthLabel }: {
  clientName: string;
  monthLabel: string;
}) {
  return (
    <header>
      <div className="mb-6 flex items-center justify-between gap-6 border-b border-[var(--admin-border)] pb-5">
        <Image
          src="/brand/holistic-marketing-logo.png"
          alt="Holistic Marketing"
          width={506}
          height={187}
          sizes="144px"
          className="h-auto w-32 shrink-0 sm:w-36"
          loading="eager"
        />
        <p className="max-w-40 text-right text-sm font-medium capitalize leading-6 text-[var(--admin-text-muted)]">
          {monthLabel}
        </p>
      </div>
      <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">Tu estado de cuenta</h1>
      <p className="mt-2 break-words text-base leading-6 text-[var(--admin-text-muted)]">{clientName}</p>
    </header>
  );
}
