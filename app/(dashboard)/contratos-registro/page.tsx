import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAllianceStaff } from "@/features/alliances/lib/access.server";
import { refreshRegistrationSignaturesAction } from "@/features/contracts/actions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RegistrationContractRow {
  id: string;
  email: string;
  legal_name: string;
  party_type: "natural" | "company";
  doc_type: "dni" | "ruc";
  doc_number: string;
  status: string;
  external_ref: string | null;
  signed_at: string | null;
  signed_storage_path: string | null;
  checkout_returned_at: string | null;
  created_at: string;
}

export default async function RegistrationContractsPage() {
  await requireAllianceStaff();
  const admin = createAdminClient();
  const loaded = await admin
    .from("client_service_contracts")
    .select(
      "id, email, legal_name, party_type, doc_type, doc_number, status, external_ref, signed_at, signed_storage_path, checkout_returned_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <>
      <AdminPageHeader
        eyebrow="Registro"
        title="Contratos de registro"
        description="El mismo contrato de servicios que se firma en la reunión. Aquí se ve quién lo envió, si FirmEasy lo recibió y si ya quedó firmado."
        actions={
          <form action={refreshRegistrationSignaturesAction}>
            <button
              type="submit"
              className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-medium"
            >
              Actualizar firmas
            </button>
          </form>
        }
      />
      {loaded.error ? (
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-sm text-[var(--admin-text-muted)]">
          No se pudo cargar la lista. Aplica las migraciones 046, 047 y 048.
        </div>
      ) : (loaded.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-sm text-[var(--admin-text-muted)]">
          Todavía no hay contratos de registro.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[var(--admin-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">FirmEasy</th>
                <th className="px-4 py-3 font-medium">Firma</th>
                <th className="px-4 py-3 font-medium">Volvió de NAS</th>
              </tr>
            </thead>
            <tbody>
              {await Promise.all(
                ((loaded.data ?? []) as RegistrationContractRow[]).map(async (row) => (
                  <tr key={row.id} className="border-t border-[var(--admin-border)]">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.legal_name}</div>
                      <div className="text-[var(--admin-text-muted)]">{row.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {row.party_type === "company" ? "Empresa" : "Persona natural"}
                      <div className="text-[var(--admin-text-muted)]">
                        {row.doc_type.toUpperCase()} {row.doc_number}
                      </div>
                    </td>
                    <td className="px-4 py-3">{firmEasyLabel(row)}</td>
                    <td className="px-4 py-3">
                      {statusLabel(row.status)}
                      {row.signed_storage_path ? (
                        <div>
                          <a className="underline" href={await signedPdfUrl(row.signed_storage_path)}>
                            PDF firmado
                          </a>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{row.checkout_returned_at ? "Sí" : "No"}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function firmEasyLabel(row: RegistrationContractRow): string {
  if (row.external_ref) return "Enviado";
  return "Sin envío";
}

function statusLabel(status: string): string {
  if (status === "signed") return "Firmado";
  if (status === "rejected") return "Rechazado";
  if (status === "pending_signature") return "Pendiente";
  return "Borrador";
}

async function signedPdfUrl(path: string): Promise<string> {
  const signed = await createAdminClient().storage.from("registration-contracts").createSignedUrl(path, 60 * 10);
  return signed.data?.signedUrl ?? "#";
}
