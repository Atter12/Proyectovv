import { NextResponse } from "next/server";
import {
  PublicLoPagadoError,
  resolvePublicLoPagado,
  uploadPublicLoPagadoProof,
} from "@/lib/payments/public-lo-pagado.server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string; intentId: string }> },
) {
  const { token, intentId } = await context.params;
  const ctx = await resolvePublicLoPagado(token);
  if (!ctx) {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }

  const proofField = formData.get("proof") ?? formData.get("file");
  if (!(proofField instanceof File)) {
    return NextResponse.json({ error: "Comprobante requerido." }, { status: 400 });
  }

  const payMethodRaw = String(formData.get("payMethod") ?? "")
    .trim()
    .toLowerCase();
  const payMethod =
    payMethodRaw === "binance" || payMethodRaw === "bank" ? payMethodRaw : null;

  try {
    const result = await uploadPublicLoPagadoProof({
      ctx,
      intentId,
      proof: proofField,
      payMethod,
    });
    return NextResponse.json({
      ok: true,
      paymentIntent: {
        autoApproved: result.autoApproved,
        creditUsdCents: result.creditUsdCents,
        status: result.status,
      },
    });
  } catch (error) {
    const message =
      error instanceof PublicLoPagadoError
        ? error.message
        : "No se pudo subir el comprobante.";
    const status = error instanceof PublicLoPagadoError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
