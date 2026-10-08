import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { nowPaymentsCoversFirstQuote } from "./nowpayments-ipn";

/**
 * Primera cotización en cripto que NOWPayments le mostró al cliente para una orden
 * (el primer aviso «waiting»). Si después recotiza y el pago queda «corto» por la
 * diferencia, lo que vale es lo que se le pidió primero.
 * Caso de origen: Wilder Remolina, 08/10/2026 (75.494282 pedido y pagado; recotizó a 75.736217).
 */
export async function nowPaymentsFirstQuote(orderId: string): Promise<number | null> {
  const { data, error } = await createAdminClient()
    .from("webhook_events")
    .select("payload,created_at")
    .eq("provider", "crypto")
    .contains("payload", { order_id: orderId, payment_status: "waiting" })
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.length) return null;
  const amount = Number((data[0]!.payload as { pay_amount?: number | string })?.pay_amount);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** ¿El pago «incompleto» en realidad cubre la primera cotización? */
export async function nowPaymentsPaidFirstQuote(orderId: string | undefined, actuallyPaid: number | undefined): Promise<{ covers: boolean; firstQuote: number | null }> {
  if (!orderId || actuallyPaid == null) return { covers: false, firstQuote: null };
  const firstQuote = await nowPaymentsFirstQuote(orderId);
  return { covers: nowPaymentsCoversFirstQuote(actuallyPaid, firstQuote), firstQuote };
}
