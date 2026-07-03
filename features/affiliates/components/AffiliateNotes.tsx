interface AffiliateNotesProps {
  notes: string[];
}

export function AffiliateNotes({ notes }: AffiliateNotesProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <h3 className="text-sm font-semibold text-slate-900">Notas</h3>
      <ul className="mt-3 space-y-2">
        {notes.map((note) => (
          <li key={note} className="flex gap-2 text-sm text-slate-600">
            <span className="text-indigo-500">•</span>
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
