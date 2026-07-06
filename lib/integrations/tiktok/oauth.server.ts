import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/env.server";

interface TikTokOAuthStatePayload {
  organizationId: string;
  userId: string;
  nonce: string;
  createdAt: number;
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signingSecret(): string {
  return serverEnv.encryptionKey || serverEnv.internalJobSecret || "development-only";
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createTikTokOAuthState(input: {
  organizationId: string;
  userId: string;
}): string {
  const payload: TikTokOAuthStatePayload = {
    organizationId: input.organizationId,
    userId: input.userId,
    nonce: randomUUID(),
    createdAt: Date.now(),
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyTikTokOAuthState(
  state: string | null,
): TikTokOAuthStatePayload | null {
  if (!state) return null;
  const [encoded, providedSignature] = state.split(".");
  if (!encoded || !providedSignature) return null;

  const expectedSignature = sign(encoded);
  try {
    if (
      !timingSafeEqual(
        Buffer.from(providedSignature),
        Buffer.from(expectedSignature),
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64url(encoded)) as TikTokOAuthStatePayload;
    const ageMinutes = (Date.now() - payload.createdAt) / 60_000;
    if (ageMinutes > 15) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildTikTokAuthorizationUrl(input: {
  organizationId: string;
  userId: string;
}): string {
  if (!serverEnv.tiktokClientKey) {
    throw new Error("[tiktok] TIKTOK_CLIENT_KEY no configurado.");
  }

  const redirectUri = serverEnv.tiktokRedirectUri || `${serverEnv.appUrl}/api/integrations/tiktok/callback`;
  const params = new URLSearchParams();
  params.set("app_id", serverEnv.tiktokClientKey);
  params.set("redirect_uri", redirectUri);
  params.set("state", createTikTokOAuthState(input));
  if (serverEnv.tiktokScopes.length > 0) {
    params.set("scope", serverEnv.tiktokScopes.join(","));
  }

  return `${serverEnv.tiktokAuthBaseUrl}?${params.toString()}`;
}
