import { NextResponse } from "next/server";
import { siteConfig } from "@/config/site";
import { getSession } from "@/lib/auth/session.server";
import { getOrganizationWallet } from "@/lib/auth/wallet.server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const wallet = await getOrganizationWallet(session);

  return NextResponse.json(
    {
      ok: true,
      wallet: wallet ?? {
        id: "pending",
        name: siteConfig.walletName,
        balance: 0,
        currency: "USD",
      },
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
