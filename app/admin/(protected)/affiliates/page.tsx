import { updateReferralAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listAffiliates } from "@/lib/admin/data";
import { formatDateTime, formatMoney, percent } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const { codes, referrals } = await listAffiliates({ q, status });

  return (
    <>
      <AdminPageHeader eyebrow="Growth" title="Afiliados" description="Audita códigos de referido, atribuciones, conversiones, comisiones aprobadas y pagos." />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por código, organización o referrer…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="pending">Pendientes</option>
            <option value="converted">Convertidos</option>
            <option value="closed">Cerrados</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <div className="grid gap-6 xl:grid-cols-2">
          <section>
            <h2 className="mb-3 text-lg font-black text-slate-950">Códigos</h2>
            <TableWrap>
              <Table>
                <thead><tr><Th>Código</Th><Th>Dueño</Th><Th>Org</Th><Th>Estado</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {codes.map(({ row, organization, actor }) => (
                    <tr key={row.id}>
                      <Td><Badge tone="purple">{row.code}</Badge><p className="text-xs text-slate-400">{formatDateTime(row.created_at)}</p></Td>
                      <Td>{actor?.email ?? "—"}</Td>
                      <Td>{organization?.name ?? "—"}</Td>
                      <Td><StatusBadge status={row.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-black text-slate-950">Referrals y comisiones</h2>
            <TableWrap>
              <Table>
                <thead><tr><Th>Referral</Th><Th>Referido</Th><Th>Comisión</Th><Th>Acción</Th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {referrals.map(({ row, organization, actor }) => (
                    <tr key={row.id}>
                      <Td><p className="font-black text-slate-950">{row.id.slice(0, 8)}</p><StatusBadge status={row.status} /></Td>
                      <Td>{organization?.name ?? "—"}<p className="text-xs text-slate-400">Ref: {actor?.email ?? "—"}</p></Td>
                      <Td><span className="font-black text-slate-950">{formatMoney(row.commission_amount_cents, "USD")}</span><p className="text-xs text-slate-400">Rate {percent(Number(row.commission_rate) * 100)}</p></Td>
                      <Td>
                        <div className="flex flex-wrap gap-2">
                          <form action={updateReferralAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="mode" value="approve" /><Button type="submit" variant="success" size="sm">Aprobar</Button></form>
                          <form action={updateReferralAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="mode" value="paid" /><Button type="submit" variant="secondary" size="sm">Pagado</Button></form>
                          <form action={updateReferralAction}><input type="hidden" name="id" value={row.id} /><input type="hidden" name="mode" value="reject" /><Button type="submit" variant="danger" size="sm">Cerrar</Button></form>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </section>
        </div>
      </Card>
    </>
  );
}
