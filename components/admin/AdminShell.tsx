import type { ReactNode } from "react";
import { AdminShellChrome } from "@/components/admin/AdminShellChrome.client";
import type { AdminSession } from "@/lib/admin/auth";
import { getAdminNavSignals } from "@/lib/admin/data";
import { serverEnv } from "@/lib/env/env.server";

export async function AdminShell({ admin, children }: { admin: AdminSession; children: ReactNode }) {
  const navSignals = await getAdminNavSignals();

  return (
    <AdminShellChrome admin={admin} appName={serverEnv.appName} navSignals={navSignals}>
      {children}
    </AdminShellChrome>
  );
}
