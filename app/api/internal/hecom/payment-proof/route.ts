import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleHecomPaymentProof } from "@/lib/hecom/payment-proof.server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  return handleHecomPaymentProof(request, {
    secret: serverEnv.hecomCobrosBridgeSecret,
    supabaseUrl: serverEnv.supabaseUrl,
    createAdmin: createAdminClient,
  });
}
