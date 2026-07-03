import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/config/auth";
import { serverEnv } from "@/lib/env/env.server";
import { createMockSessionPayload } from "@/lib/auth/mock-session";
import { signSessionToken, verifySessionToken } from "@/lib/auth/session-token";
import type { SessionPayload, SessionUser } from "@/types/auth";

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function sessionPayloadToUser(payload: SessionPayload): SessionUser {
  return {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    avatarInitials: payload.avatarInitials,
    role: payload.role,
    permissions: payload.permissions,
    companyId: payload.companyId,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token, serverEnv.sessionSecret);
  if (!payload) return null;

  return sessionPayloadToUser(payload);
}

export async function createMockSession(): Promise<string> {
  const payload = createMockSessionPayload();
  return signSessionToken(payload, serverEnv.sessionSecret);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
}

export { verifySessionToken };
