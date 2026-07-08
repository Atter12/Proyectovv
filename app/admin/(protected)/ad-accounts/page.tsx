import { archiveAdAccountAction, updateAdAccountStatusAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listAdAccounts } from "@/lib/admin/data";
import { AD_ACCOUNT_STATUS_LABELS } from "@/lib/constants/status";
import { formatDateTime, formatMoney } from "@/lib/format";
import { isRecord } from "@/lib/types/json";

export const dynamic = "force-dynamic";

function isArchived(metadata: unknown): boolean {
  return isRecord(metadata) && typeof metadata.archived_at === "string";
}

export default async function AdAccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const platform = typeof params.platform === "string" ? params.platform : "all";
  const accounts = await listAdAccounts({ q, status, platform });

  return (
    <>
      <AdminPageHeader eyebrow="Operación ads" title="Cuentas publicitarias" description="Administra estados, bloqueos operativos, archivo lógico y revisión de configuración de cuentas internas o conectadas." />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 lg:grid-cols-[1fr_12rem_12rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por cuenta, ID externo, business o cliente…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Estado</option>
            <option value="active">Activa</option>
            <option value="pending">Pendiente</option>
            <option value="disabled">Desactivada</option>
            <option value="review">Revisión</option>
          </Select>
          <Select name="platform" defaultValue={platform}>
            <option value="all">Plataforma</option>
            <option value="tiktok">TikTok</option>
            <option value="meta">Meta</option>
            <option value="google">Google</option>
            <option value="linkedin">LinkedIn</option>
            <option value="other">Otra</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <TableWrap>
          <Table>
            <thead><tr><Th>Cuenta</Th><Th>Cliente</Th><Th>Saldo</Th><Th>Límites</Th><Th>Estado</Th><Th>Acción</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map(({ row, organization, balance }) => {
                const archived = isArchived(row.metadata);
                return (
                  <tr key={row.id}>
                    <Td>
                      <p className="font-black text-slate-950">{row.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone="purple">{row.platform}</Badge>
                        <Badge tone={row.external_account_id ? "success" : "neutral"}>{row.external_account_id ? "Conectada" : "Manual"}</Badge>
                        {archived ? <Badge tone="danger">Archivada</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{row.external_account_id ?? row.id}</p>
                    </Td>
                    <Td>{organization?.name ?? "—"}<p className="text-xs text-slate-400">{organization?.slug}</p></Td>
                    <Td><span className="font-black text-slate-950">{formatMoney(balance?.balance_cents ?? 0, balance?.currency ?? row.currency)}</span><p className="text-xs text-slate-400">Reservado {formatMoney(balance?.reserved_balance_cents ?? 0, balance?.currency ?? row.currency)}</p></Td>
                    <Td>{formatMoney(row.daily_budget_cents, row.currency)} / día<p className="text-xs text-slate-400">Mensual {formatMoney(row.monthly_limit_cents ?? 0, row.currency)}</p></Td>
                    <Td><StatusBadge status={row.status} label={AD_ACCOUNT_STATUS_LABELS[row.status] ?? row.status} /><p className="mt-1 text-xs text-slate-400">Sync {formatDateTime(row.last_synced_at)}</p></Td>
                    <Td>
                      <div className="grid gap-2">
                        <form action={updateAdAccountStatusAction} className="flex gap-2">
                          <input type="hidden" name="id" value={row.id} />
                          <Select name="status" defaultValue={row.status} className="h-9 rounded-xl text-xs">
                            <option value="active">Activa</option>
                            <option value="pending">Pendiente</option>
                            <option value="disabled">Desactivada</option>
                            <option value="review">Revisión</option>
                          </Select>
                          <Button type="submit" variant="secondary" size="sm">Guardar</Button>
                        </form>
                        <form action={archiveAdAccountAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="mode" value={archived ? "unarchive" : "archive"} />
                          <Button type="submit" variant={archived ? "success" : "danger"} size="sm" className="w-full">{archived ? "Desarchivar" : "Archivar"}</Button>
                        </form>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
