import { NextResponse } from "next/server";
import { verifyTikTokOAuthState } from "@/lib/integrations/tiktok/oauth.server";
import {
  exchangeTikTokAuthCode,
  importTikTokAdvertiserAccounts,
  upsertTikTokConnection,
} from "@/lib/integrations/tiktok/client.server";
import { serverEnv } from "@/lib/env/env.server";

function redirectToPayments(status: string, message?: string) {
  const url = new URL("/ad-accounts", serverEnv.appUrl);
  url.searchParams.set("integration", "tiktok");
  url.searchParams.set("status", status);
  if (message) url.searchParams.set("message", message.slice(0, 160));
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tiktokError =
    url.searchParams.get("error") ??
    url.searchParams.get("error_type") ??
    url.searchParams.get("msg");
  const tiktokErrorDescription =
    url.searchParams.get("error_description") ??
    url.searchParams.get("error_message") ??
    url.searchParams.get("message");

  if (tiktokError) {
    return redirectToPayments(
      "failed",
      `TikTok: ${tiktokError}${tiktokErrorDescription ? ` - ${tiktokErrorDescription}` : ""}`,
    );
  }

  const authCode = url.searchParams.get("auth_code") ?? url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  const state = verifyTikTokOAuthState(rawState);

  if (!authCode && !rawState) {
    return redirectToPayments(
      "failed",
      "Abre /api/integrations/tiktok/connect (no abras el callback directo)",
    );
  }
  if (!authCode) {
    return redirectToPayments("failed", "TikTok no devolvió auth_code");
  }
  if (!state) {
    return redirectToPayments(
      "failed",
      "State OAuth inválido o expirado (reintenta Connect en menos de 15 min)",
    );
  }

  try {
    const tokenBundle = await exchangeTikTokAuthCode(authCode);
    await upsertTikTokConnection({
      organizationId: state.organizationId,
      userId: state.userId,
      tokenBundle,
    });
    await importTikTokAdvertiserAccounts({
      organizationId: state.organizationId,
      userId: state.userId,
    });
    return redirectToPayments("connected");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo conectar TikTok.";
    return redirectToPayments("failed", message);
  }
}
