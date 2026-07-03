import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  });
}
