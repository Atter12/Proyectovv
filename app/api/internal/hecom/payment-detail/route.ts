import { serverEnv } from "@/lib/env/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleHecomPaymentDetail } from "@/lib/hecom/payment-detail.server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  return handleHecomPaymentDetail(request, {
    secret: serverEnv.hecomCobrosBridgeSecret,
    createAdmin: createAdminClient,
  });
}
