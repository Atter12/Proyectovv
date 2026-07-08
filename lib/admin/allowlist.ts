import { serverEnv } from "@/lib/env/env.server";

export function userIsAllowedAdmin(user: { id: string; email?: string | null }): boolean {
  const email = (user.email ?? "").toLowerCase();
  const emailAllowed = serverEnv.adminAllowedEmails.includes(email);
  const idAllowed = serverEnv.adminAllowedUserIds.includes(user.id);

  if (emailAllowed || idAllowed) return true;

  const noAllowlist =
    serverEnv.adminAllowedEmails.length === 0 && serverEnv.adminAllowedUserIds.length === 0;
  return noAllowlist && !serverEnv.isProduction;
}
