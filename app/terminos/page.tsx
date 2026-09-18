import type { Metadata } from "next";
import { PublicLegalShell } from "@/features/legal/PublicLegalShell";
import { legalCompany } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Términos y condiciones · Holistic Marketing",
  description: "Términos y condiciones del servicio de recarga y operación publicitaria.",
};

export default function TermsPage() {
  return (
    <PublicLegalShell title="Términos y condiciones">
      <p>
        Estos términos rigen el uso de {legalCompany.site}, operado por{" "}
        {legalCompany.legalName}, RUC {legalCompany.ruc}, con nombre comercial{" "}
        {legalCompany.tradeName}, sede en {legalCompany.city}. Contacto:{" "}
        {legalCompany.email}.
      </p>
      <p>
        El servicio es digital: recarga de saldo en la cartera Holistic y
        asignación de ese saldo a cuentas de anuncios, principalmente TikTok.
        No vendemos productos físicos ni hacemos envíos.
      </p>
      <p>
        Para comprar hay que crear una cuenta, elegir el monto y pagar con los
        medios que aparecen en el checkout. El precio y la comisión se muestran
        antes de confirmar. El saldo entra a la cartera recién cuando el pago
        queda acreditado.
      </p>
      <p>
        El cliente es responsable de los anuncios que publique y de cumplir las
        políticas de TikTok y la ley peruana. Holistic puede pausar una cuenta
        si el pago se desconoce, el voucher no cuadra o hay uso indebido.
      </p>
      <p>
        Los cambios, devoluciones y reclamos se rigen por la política de
        cambios y devoluciones y por el Libro de reclamaciones de este mismo
        sitio. Ley aplicable: República del Perú.
      </p>
    </PublicLegalShell>
  );
}
