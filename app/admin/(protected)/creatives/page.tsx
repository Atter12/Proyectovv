import { updateCreativeJobAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JsonPreview } from "@/components/admin/JsonPreview";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listCreativeWork } from "@/lib/admin/data";
import { formatDateTime, formatInteger } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CreativesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const { jobs, assets } = await listCreativeWork({ q, status });

  return (
    <>
      <AdminPageHeader eyebrow="IA creativa" title="Creativos y análisis" description="Supervisa uploads del cliente, jobs de análisis y resultados. El proveedor IA puede conectarse después sin cambiar la operación base." />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por job, asset, proveedor, modelo o cliente…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Todos</option>
            <option value="queued">En cola</option>
            <option value="processing">Procesando</option>
            <option value="completed">Completado</option>
            <option value="failed">Fallido</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--admin-text)]">Jobs</h2>
            <TableWrap>
              <Table>
                <thead><tr><Th>Job</Th><Th>Asset</Th><Th>Proveedor</Th><Th>Score</Th><Th>Acción</Th></tr></thead>
                <tbody className="divide-y divide-[var(--admin-table-divider)]">
                  {jobs.map(({ row, organization, asset, result }) => (
                    <tr key={row.id}>
                      <Td><p className="font-semibold text-[var(--admin-text)]">{row.id.slice(0, 8)}</p><StatusBadge status={row.status} /><p className="text-xs text-[var(--admin-text-muted)]">{formatDateTime(row.created_at)}</p></Td>
                      <Td>{asset?.name ?? "—"}<p className="text-xs text-[var(--admin-text-muted)]">{organization?.name ?? "—"}</p></Td>
                      <Td><Badge tone="purple">{row.provider}</Badge><p className="text-xs text-[var(--admin-text-muted)]">{row.model ?? "modelo pendiente"}</p></Td>
                      <Td className="font-semibold text-[var(--admin-text)]">{result?.overall_score ?? "—"}</Td>
                      <Td>
                        <form action={updateCreativeJobAction} className="grid gap-2">
                          <input type="hidden" name="id" value={row.id} />
                          <Select name="status" defaultValue={row.status} className="h-9 rounded-xl text-xs">
                            <option value="queued">Queued</option>
                            <option value="processing">Processing</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                          </Select>
                          <Button type="submit" variant="secondary" size="sm">Actualizar</Button>
                        </form>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[var(--admin-text)]">Assets recientes</h2>
            <div className="space-y-3">
              {assets.slice(0, 8).map(({ row, organization }) => (
                <div key={row.id} className="rounded-2xl border border-[#d7e7ee] bg-white p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[var(--admin-text)]">{row.name}</p><p className="text-xs text-[var(--admin-text-muted)]">{organization?.name ?? "—"}</p></div><StatusBadge status={row.status} /></div>
                  <p className="mt-2 text-sm text-[var(--admin-text-muted)]">{row.asset_type} · {row.mime_type ?? "mime n/a"} · {formatInteger(row.file_size_bytes)} bytes</p>
                  {row.public_url ? <a href={row.public_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-semibold text-[var(--admin-accent)]">Abrir asset ↗</a> : null}
                </div>
              ))}
            </div>
          </section>
        </div>
        {jobs[0]?.result ? <div className="mt-6"><JsonPreview title="Último resultado" value={jobs[0].result} /></div> : null}
      </Card>
    </>
  );
}
