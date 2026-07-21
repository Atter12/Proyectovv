interface AffiliateNotesProps {
  notes: string[];
}

export function AffiliateNotes({ notes }: AffiliateNotesProps) {
  return (
    <div className="rounded-2xl border border-[var(--brand-primary)]/10 bg-gradient-to-br from-[var(--brand-primary)]/5 to-white p-5 sm:p-6">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#0f172a]">Notas importantes</h3>
          <ul className="mt-3 space-y-2.5">
            {notes.map((note) => (
              <li key={note} className="flex gap-2.5 text-sm leading-relaxed text-[#64748b]">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
