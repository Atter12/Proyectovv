import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { pollBankAndReconcile } from "@/lib/support/recharge-bot/service.server";

export const runtime="nodejs";
export const maxDuration=60;
export async function GET(request:Request) {
  const expected=process.env.CRON_SECRET;
  const provided=request.headers.get("authorization");
  if(!expected||!provided||Buffer.byteLength(provided)!==Buffer.byteLength(`Bearer ${expected}`)||!timingSafeEqual(Buffer.from(provided),Buffer.from(`Bearer ${expected}`)))return NextResponse.json({error:"No autorizado."},{status:401});
  try{await pollBankAndReconcile();return NextResponse.json({ok:true});}
  catch{return NextResponse.json({error:"La validación bancaria requiere revisión."},{status:503});}
}
