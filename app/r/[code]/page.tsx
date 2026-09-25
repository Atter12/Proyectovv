import { redirect } from "next/navigation";

const REFERRAL_CODE = /^[a-zA-Z0-9_-]{2,64}$/;

/** Enlace corto del programa. El registro guarda el código y cuenta el clic. */
export default async function ReferralLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  let decoded = code;
  try {
    decoded = decodeURIComponent(code);
  } catch {
    decoded = code;
  }

  const safe = decoded.trim();
  if (!REFERRAL_CODE.test(safe)) {
    redirect("/register");
  }

  redirect(`/register?ref=${encodeURIComponent(safe)}`);
}
