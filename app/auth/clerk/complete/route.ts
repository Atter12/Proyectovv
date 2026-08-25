import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkConfigured, clerkRoutes } from "@/lib/auth/clerk";
import { completeClerkLoginToHolistic } from "@/lib/auth/clerk-bridge.server";
import { routes } from "@/config/routes";
import { serverEnv } from "@/lib/env/env.server";

export const dynamic = "force-dynamic";

/**
 * Tras SignIn/SignUp de Clerk: puente a sesión Supabase Holistic + Hecom.
 * forceRedirectUrl apunta acá.
 */
export async function GET() {
  if (!clerkConfigured()) {
    return NextResponse.redirect(new URL(routes.login, serverEnv.appUrl));
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL(clerkRoutes.signIn, serverEnv.appUrl));
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(new URL(clerkRoutes.signIn, serverEnv.appUrl));
  }

  return completeClerkLoginToHolistic(user);
}
