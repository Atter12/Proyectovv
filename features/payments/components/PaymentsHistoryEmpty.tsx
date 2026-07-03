export function PaymentsHistoryEmpty() {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-[#e5e7eb]">
        <svg
          className="h-6 w-6 text-[#64748b]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      </div>
      <p className="text-sm font-semibold text-[#0f172a]">No hay registros</p>
      <p className="mt-1 max-w-sm text-sm text-[#64748b]">
        Las transacciones aparecerán aquí cuando realices operaciones.
      </p>
    </div>
  );
}
