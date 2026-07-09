import { signOutAdminAction } from "@/app/actions/admin-auth";
import type { AdminSession } from "@/lib/admin/auth";

function getInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

type AdminSidebarUserSessionProps = {
  admin: AdminSession;
};

export function AdminSidebarUserSession({ admin }: AdminSidebarUserSessionProps) {
  const displayName = admin.fullName ?? admin.email.split("@")[0] ?? admin.email;
  const initials = getInitials(admin.fullName, admin.email);

  return (
    <div className="admin-session-panel mt-2 shrink-0 border-t border-[var(--admin-divider)] pt-3">
      <div className="flex items-center gap-2.5 px-1">
        {admin.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={admin.avatarUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[var(--admin-accent)]/22"
          />
        ) : (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--admin-accent)]/10 text-[0.65rem] font-black text-[var(--admin-accent)] ring-1 ring-[var(--admin-accent)]/18"
            aria-hidden
          >
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--admin-text)]">{displayName}</p>
          <p className="truncate text-xs font-semibold text-[var(--admin-text-muted)]">{admin.email}</p>
        </div>
      </div>
      <form action={signOutAdminAction} className="mt-2 px-1">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--admin-accent)]/22 bg-[var(--admin-accent)]/8 px-2 py-1.5 text-[0.68rem] font-bold text-[var(--admin-accent)] transition hover:border-[var(--admin-accent)]/35 hover:bg-[var(--admin-accent)]/14"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Salir
        </button>
      </form>
    </div>
  );
}
