import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TYPES = new Set(["reclamo", "queja"]);
const DOCS = new Set(["DNI", "CE", "Pasaporte"]);

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const claimType = text(body.claimType, 20);
  const documentType = text(body.documentType, 20);
  const consumerName = text(body.consumerName, 120);
  const documentNumber = text(body.documentNumber, 20);
  const address = text(body.address, 180);
  const phone = text(body.phone, 30);
  const email = text(body.email, 120);
  const product = text(body.product, 160);
  const detail = text(body.detail, 2000);
  const requestText = text(body.request, 1000);
  const amountText = text(body.amountText, 40);
  const isMinor = body.isMinor === true;
  const guardianName = text(body.guardianName, 120);

  if (!TYPES.has(claimType) || !DOCS.has(documentType)) {
    return NextResponse.json({ error: "Revisa el tipo de reclamo y el documento." }, { status: 400 });
  }
  if (consumerName.length < 3 || address.length < 5 || phone.length < 6) {
    return NextResponse.json({ error: "Completa nombre, domicilio y teléfono." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "El correo no es válido." }, { status: 400 });
  }
  if (documentNumber.length < 6 || product.length < 3 || detail.length < 15 || requestText.length < 8) {
    return NextResponse.json(
      { error: "Falta el detalle del reclamo o el pedido." },
      { status: 400 },
    );
  }
  if (isMinor && guardianName.length < 3) {
    return NextResponse.json(
      { error: "Si es menor, indica el nombre del padre, madre o tutor." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const year = new Date().getFullYear();
  const { count } = await admin
    .from("consumer_claims")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01T00:00:00.000Z`);
  const claimCode = `LR-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`;

  const { error } = await admin.from("consumer_claims").insert({
    claim_code: claimCode,
    claim_type: claimType,
    consumer_name: consumerName,
    document_type: documentType,
    document_number: documentNumber,
    address,
    phone,
    email,
    is_minor: isMinor,
    guardian_name: isMinor ? guardianName : null,
    product,
    amount_text: amountText || null,
    detail,
    request: requestText,
  });

  if (error) {
    console.warn("[libro-reclamaciones]", error.message);
    return NextResponse.json(
      { error: "No se pudo registrar el reclamo. Inténtalo de nuevo." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    claimCode,
    createdAt: new Date().toISOString(),
  });
}
