"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Evita flash de Clerk SSR vs client mount. */
export function ClerkMountGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-[1.25rem] border border-[var(--auth-divider)] bg-white px-4 py-10 text-[13px] text-[var(--auth-text-muted)]">
        Cargando acceso…
      </div>
    );
  }
  return <>{children}</>;
}
