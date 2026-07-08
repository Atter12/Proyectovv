import type { ReactNode } from "react";
import { AdminShellChrome } from "@/components/admin/AdminShellChrome.client";
import type { AdminSession } from "@/lib/admin/auth";
import { serverEnv } from "@/lib/env/env.server";

export function AdminShell({ admin, children }: { admin: AdminSession; children: ReactNode }) {
  return (
    <AdminShellChrome admin={admin} appName={serverEnv.appName}>
      {children}
    </AdminShellChrome>
  );
}
