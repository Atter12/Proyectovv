import type { Metadata } from "next";
import { ComplaintsBookForm } from "@/features/legal/ComplaintsBookForm.client";
import { PublicLegalShell } from "@/features/legal/PublicLegalShell";
import { legalCompany } from "@/lib/legal/company";

export const metadata: Metadata = {
  title: "Libro de reclamaciones · Holistic Marketing",
  description: "Libro de reclamaciones virtual conforme a INDECOPI.",
};

export default function ComplaintsPage() {
  return (
    <PublicLegalShell title="Libro de reclamaciones">
      <p>
        Hoja de reclamación virtual de {legalCompany.legalName}, RUC{" "}
        {legalCompany.ruc}, {legalCompany.city}. Correo: {legalCompany.email}.
        No necesitas iniciar sesión. Este formulario está en el sitio; no es un
        archivo externo.
      </p>
      <p>
        <strong>Reclamo:</strong> disconformidad con el servicio.{" "}
        <strong>Queja:</strong> disconformidad con la atención. El proveedor
        debe responder en un máximo de 15 días hábiles. La constancia con el
        código queda en pantalla al enviar. Conservamos el registro al menos 2
        años, según la norma de INDECOPI.
      </p>
      <ComplaintsBookForm />
    </PublicLegalShell>
  );
}
