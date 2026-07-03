const steps = [
  "Comparte tu enlace.",
  "Añade una referencia publicada.",
  "Tus referidos también gastan más.",
  "Relájate y empieza a ganar dinero.",
];

export function ReferralStepList() {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {index + 1}
          </div>
          <p className="pt-1 text-sm text-slate-700">{step}</p>
        </li>
      ))}
    </ol>
  );
}
