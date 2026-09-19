import { NextResponse } from "next/server";
import { resolveHolisticUsdPenRate } from "@/lib/payments/fx-rate.server";

// Public quote only: the same resolver used when creating payment intents.
// No customer, bank account, payment or authentication data is returned.
export async function GET() {
  const quote = await resolveHolisticUsdPenRate();
  return NextResponse.json({
    provider: "adsholistic",
    pair: "USD/PEN",
    usdPen: quote.usdPen,
    source: quote.source,
    asOf: quote.asOf,
    queriedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } });
}
