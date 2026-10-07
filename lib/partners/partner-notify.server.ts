import "server-only";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import { resolveManualPaymentManagerEmails } from "@/lib/email/manual-payment-notify.server";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { partnerLandingPath } from "./partners.shared";

/**
 * Avisos de Alianzas por correo: al equipo (gerentes) y al aliado.
 *  - signup:         alguien se registró con su link.
 *  - first_recharge: un cliente suyo hizo su primera recarga (empieza a ganar).
 *  - signed:         firmó su contrato de alianza (se le abrió la sección).
 *  - payout:         se le pagó su comisión.
 * Nunca lanza: un aviso fallido no puede tumbar el registro, la recarga ni la firma.
 */

const SITE = "https://www.adsholistic.com";

export type PartnerEvent =
  | { kind: "signup"; partnerId: string; clienteEmail: string; hecomClienteId: string }
  | { kind: "first_recharge"; partnerId: string; hecomClienteId: string; paymentIntentId: string; commissionCents: number }
  | { kind: "signed"; partnerId: string }
  | { kind: "payout"; partnerId: string; paidCents: number; method: string; reference: string | null };

type PartnerRow = {
  id: string;
  slug: string;
  name: string;
  company_name: string | null;
  hecom_cliente_id: string | null;
  commission_rate: number | string;
  commission_days: number;
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** «María Fernanda Quispe» → «María F.»: el aliado reconoce a su referido sin ver sus datos. */
function mask(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Un cliente";
  return parts[1] ? `${parts[0]} ${parts[1][0]!.toUpperCase()}.` : parts[0]!;
}

async function clienteInfo(id: string | null): Promise<{ name: string | null; email: string | null }> {
  if (!id) return { name: null, email: null };
  const { data } = await createHecomAdminClient().from("clientes").select("name,emails").eq("id", id).maybeSingle();
  const emails = Array.isArray(data?.emails) ? (data!.emails as unknown[]) : [];
  const email = emails.map((e) => String(e ?? "").trim()).find((e) => e.includes("@")) ?? null;
  return { name: data?.name ? String(data.name) : null, email };
}

function layout(title: string, lines: string[], cta?: { href: string; label: string }): string {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
  <p style="font-size:12px;color:#9a6b4a;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0">Alianzas · Ads Holistic</p>
  <h1 style="font-size:20px;margin:6px 0 14px">${esc(title)}</h1>
  ${lines.map((l) => `<p style="font-size:14px;line-height:1.5;margin:0 0 8px">${l}</p>`).join("")}
  ${cta ? `<p style="margin:18px 0 0"><a href="${cta.href}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:10px">${esc(cta.label)}</a></p>` : ""}
</div>`;
}

async function send(to: string[] | string, subject: string, html: string, key: string, kind: string) {
  try {
    await sendTransactionalEmail({ to, subject, html, templateKey: `partners.${kind}`, idempotencyKey: key });
  } catch (error) {
    console.warn("[partner-notify] send_failed", { kind, error: error instanceof Error ? error.message : String(error) });
  }
}

export async function notifyPartnerEvent(event: PartnerEvent): Promise<void> {
  try {
    const { data: p } = await createAdminClient()
      .from("partners")
      .select("id,slug,name,company_name,hecom_cliente_id,commission_rate,commission_days")
      .eq("id", event.partnerId)
      .maybeSingle<PartnerRow>();
    if (!p) return;
    const brand = p.company_name?.trim() || p.name;
    const who = p.company_name ? `${p.name} (${p.company_name})` : p.name;
    const link = `${SITE}${partnerLandingPath(p.slug)}`;
    const managers = resolveManualPaymentManagerEmails();
    const aliado = await clienteInfo(p.hecom_cliente_id);
    const pct = Math.round(Number(p.commission_rate) * 1000) / 10;

    if (event.kind === "signup") {
      const c = await clienteInfo(event.hecomClienteId);
      const name = c.name ?? event.clienteEmail;
      if (managers.length) {
        await send(managers, `Nuevo registro por el link de ${brand}`, layout(`${esc(name)} se registró por el link de ${esc(who)}`, [
          `Correo: ${esc(event.clienteEmail)}`,
          `Queda a nombre del aliado durante ${p.commission_days} días: gana el ${pct}% del fee de sus recargas.`,
        ]), `partners:signup:${event.hecomClienteId}:managers`, event.kind);
      }
      if (aliado.email) {
        await send(aliado.email, `🎉 Nuevo registro con tu link`, layout(`${esc(mask(name))} se registró con tu link`, [
          `Desde ahora, por ${p.commission_days} días ganas el ${pct}% de lo que cobramos en sus recargas.`,
          `Sigue compartiendo: <a href="${link}">${link.replace("https://", "")}</a>`,
        ], { href: `${SITE}/alianzas`, label: "Ver mis números" }), `partners:signup:${event.hecomClienteId}:aliado`, event.kind);
      }
      return;
    }

    if (event.kind === "first_recharge") {
      const c = await clienteInfo(event.hecomClienteId);
      if (managers.length) {
        await send(managers, `Primera recarga de un referido de ${brand}`, layout(`${esc(c.name ?? "Un cliente")} hizo su primera recarga`, [
          `Llegó por el link de ${esc(who)}.`,
          `Comisión de esta recarga para el aliado: <b>${usd(event.commissionCents)}</b>.`,
        ]), `partners:first:${event.paymentIntentId}:managers`, event.kind);
      }
      if (aliado.email) {
        await send(aliado.email, `💸 Ganaste tu primera comisión con ${mask(c.name)}`, layout(`${esc(mask(c.name))} hizo su primera recarga`, [
          `Ganaste <b>${usd(event.commissionCents)}</b> por esta recarga. Las siguientes también suman mientras dure tu alianza.`,
        ], { href: `${SITE}/alianzas`, label: "Ver mis comisiones" }), `partners:first:${event.paymentIntentId}:aliado`, event.kind);
      }
      return;
    }

    if (event.kind === "signed") {
      if (managers.length) {
        await send(managers, `${brand} firmó su contrato de alianza`, layout(`${esc(who)} firmó su contrato`, [
          `Ya ve la sección Alianzas en Ads Holistic y puede compartir su link: <a href="${link}">${link.replace("https://", "")}</a>`,
        ]), `partners:signed:${p.id}:managers`, event.kind);
      }
      if (aliado.email) {
        await send(aliado.email, `Tu alianza con Holistic está activa`, layout(`¡Bienvenido, ${esc(p.name.split(" ")[0] ?? p.name)}!`, [
          `Tu contrato quedó firmado. Entra a <b>Alianzas</b> en Ads Holistic, pon el logo y los colores de tu empresa, y comparte tu link.`,
          `Ganas el ${pct}% del fee de cada cliente que traigas, durante ${p.commission_days} días desde que se registra.`,
        ], { href: `${SITE}/alianzas`, label: "Diseñar mi landing" }), `partners:signed:${p.id}:aliado`, event.kind);
      }
      return;
    }

    if (event.kind === "payout") {
      const ref = event.reference ? ` · ${esc(event.reference)}` : "";
      const stamp = new Date().toISOString().slice(0, 16);
      if (managers.length) {
        await send(managers, `Comisión pagada a ${brand}: ${usd(event.paidCents)}`, layout(`Se pagó ${usd(event.paidCents)} a ${esc(who)}`, [
          `Medio: ${esc(event.method)}${ref}`,
        ]), `partners:payout:${p.id}:${stamp}:managers`, event.kind);
      }
      if (aliado.email) {
        await send(aliado.email, `Te pagamos ${usd(event.paidCents)} de comisión`, layout(`Te pagamos ${usd(event.paidCents)}`, [
          `Medio: ${esc(event.method)}${ref}. Gracias por recomendarnos.`,
        ], { href: `${SITE}/alianzas`, label: "Ver mis comisiones" }), `partners:payout:${p.id}:${stamp}:aliado`, event.kind);
      }
    }
  } catch (error) {
    console.warn("[partner-notify] failed", { kind: event.kind, error: error instanceof Error ? error.message : String(error) });
  }
}
