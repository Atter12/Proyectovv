"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import styles from "./auth.module.css";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/** Evita flash de Clerk SSR vs client mount. */
export function ClerkMountGate({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!ready) {
    return (
      <div role="status" className="min-h-[280px] w-full">
        <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse">
          <div className="mb-8 space-y-3">
            <div className="h-9 w-3/5 rounded-lg bg-[var(--auth-skeleton)]" />
            <div className="h-4 w-4/5 rounded bg-[var(--auth-skeleton)]" />
          </div>
          <div className="h-[52px] rounded-xl bg-[var(--auth-skeleton)]" />
          <div className="h-[52px] rounded-xl bg-[var(--auth-skeleton)]" />
        </div>
        <p className={`mt-5 ${styles.helpText}`}>Cargando acceso…</p>
      </div>
    );
  }
  return <>{children}</>;
}
