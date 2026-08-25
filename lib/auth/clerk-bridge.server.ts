import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { User as ClerkUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensureAccountProvisionedForUser } from "@/lib/auth/account-provisioning.server";
import {
  isHecomOtpLoginEnabled,
  provisionHecomClienteAccess,
} from "@/lib/auth/hecom-otp.server";
import { routes } from "@/config/routes";
import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function clerkEmail(user: ClerkUser): string | null {
  return (
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses?.[0]?.emailAddress ??
    null
  );
}

function clerkFullName(user: ClerkUser): string {
  const joined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return joined || user.fullName || clerkEmail(user)?.split("@")[0] || "Usuario";
}

async function ensureSupabaseAuthUser(input: {
  email: string;
  fullName: string;
  clerkUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  // Prefer create; if exists, update metadata.
  const { error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      clerk_user_id: input.clerkUserId,
      auth_via: "clerk",
    },
  });

  if (!createError) return { ok: true };

  const already =
    /already|registered|exists/i.test(createError.message) ||
    createError.status === 422;

  if (!already) {
    return { ok: false, error: createError.message };
  }

  // Update metadata on existing user (best-effort scan by email).
  if (!listError && listed?.users) {
    const existing = listed.users.find(
      (u) => u.email?.toLowerCase() === input.email.toLowerCase(),
    );
    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        user_metadata: {
          ...existing.user_metadata,
          full_name:
            existing.user_metadata?.full_name ?? input.fullName,
          clerk_user_id: input.clerkUserId,
          auth_via: "clerk",
        },
      });
    }
  }

  return { ok: true };
}

/**
 * Tras login Clerk: crea/sincroniza usuario Supabase, setea cookies de sesión
 * Holistic y corre provisioning (org + Hecom).
 */
export async function completeClerkLoginToHolistic(
  clerkUser: ClerkUser,
): Promise<NextResponse> {
  const email = clerkEmail(clerkUser)?.trim().toLowerCase();
  if (!email) {
    return NextResponse.redirect(
      new URL(`${routes.login}?error=clerk_email`, serverEnv.appUrl),
    );
  }

  const fullName = clerkFullName(clerkUser);
  const ensured = await ensureSupabaseAuthUser({
    email,
    fullName,
    clerkUserId: clerkUser.id,
  });
  if (!ensured.ok) {
    return NextResponse.redirect(
      new URL(
        `${routes.login}?error=clerk_supabase&reason=${encodeURIComponent(ensured.error)}`,
        serverEnv.appUrl,
      ),
    );
  }

  const admin = createAdminClient();
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        data: {
          full_name: fullName,
          clerk_user_id: clerkUser.id,
          auth_via: "clerk",
        },
      },
    });

  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    return NextResponse.redirect(
      new URL(`${routes.login}?error=clerk_link`, serverEnv.appUrl),
    );
  }

  const pendingCookies: CookieToSet[] = [];
  const supabase = createServerClient(
    serverEnv.supabaseUrl,
    serverEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });

  if (verifyError || !verified.user) {
    return NextResponse.redirect(
      new URL(`${routes.login}?error=clerk_verify`, serverEnv.appUrl),
    );
  }

  const account = await ensureAccountProvisionedForUser(verified.user);
  let nextPath: string = routes.overview;

  if (isHecomOtpLoginEnabled()) {
    const provisioned = await provisionHecomClienteAccess({
      userId: verified.user.id,
      email,
    }).catch(() => null);
    if (provisioned) nextPath = provisioned.nextPath;
  } else if (!account.ready) {
    nextPath = routes.accountSetup;
  }

  const response = NextResponse.redirect(new URL(nextPath, serverEnv.appUrl));
  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(name, value, options);
  }
  return response;
}
