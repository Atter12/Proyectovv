import { signOutAdminAction } from "@/app/actions/admin-auth";
import { Button } from "@/components/ui/Button";
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
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--admin-accent)]/25"
          />
        ) : (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--admin-accent)]/12 text-xs font-black text-[var(--admin-accent)] ring-1 ring-[var(--admin-accent)]/22"
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
      <form action={signOutAdminAction} className="mt-2.5 px-1">
        <Button type="submit" variant="secondary" size="sm" className="h-8 w-full rounded-lg text-xs font-black">
          Salir
        </Button>
      </form>
    </div>
  );
}
