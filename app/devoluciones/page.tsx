import type { Metadata } from "next";
import Link from "next/link";
import { routes } from "@/config/routes";
import { PublicLegalShell } from "@/features/legal/PublicLegalShell";
import { legalCompany } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Cambios y devoluciones · Holistic Marketing",
  description: "Política de cambios y devoluciones de la recarga publicitaria.",
};

export default function ReturnsPage() {
  return (
    <PublicLegalShell title="Política de cambios y devoluciones">
      <p>
        {legalCompany.legalName} (RUC {legalCompany.ruc}) presta un servicio
        digital de recarga de saldo publicitario. No hay cambios de talla ni
        envíos: el “producto” es saldo en la cartera Holistic.
      </p>
      <p>
        <strong>Se puede devolver</strong> el saldo que todavía está en la
        cartera y no se asignó a una cuenta de anuncios. El pedido se hace por{" "}
        {legalCompany.email} o por el{" "}
        <Link href={routes.complaints} className="font-semibold underline">
          Libro de reclamaciones
        </Link>
        , dentro de los 7 días calendario del pago. La devolución vuelve por el
        mismo medio de pago, descontando la comisión del procesador si esa
        comisión no es reembolsable.
      </p>
      <p>
        <strong>No se devuelve</strong> el saldo ya asignado o gastado en
        TikTok u otra plataforma de anuncios, salvo error de cobro de Holistic
        (monto duplicado o cargo que no corresponde). En ese caso se corrige o
        se devuelve la diferencia.
      </p>
      <p>
        Si el pago con tarjeta o transferencia queda observado, el saldo no se
        acredita hasta verificar el cobro. Un reclamo de consumidor no reemplaza
        el contracargo del banco: primero escríbenos para resolverlo.
      </p>
      <p>Plazo de respuesta del proveedor: 15 días hábiles.</p>
    </PublicLegalShell>
  );
}
