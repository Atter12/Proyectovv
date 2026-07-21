import { createReconciliationRunAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JsonPreview } from "@/components/admin/JsonPreview";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listReconciliation } from "@/lib/admin/data";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage() {
  const { runs, items } = await listReconciliation();

  return (
    <>
      <AdminPageHeader eyebrow="Control financiero" title="Conciliación" description="Runs internos para detectar pagos aprobados sin journal, diferencias de proveedor o inconsistencias operativas." />
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Nuevo run</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--admin-text-muted)]">Genera una revisión inicial contra metadata de ledger. Los conectores externos pueden extender este flujo.</p>
          <form action={createReconciliationRunAction} className="mt-5 space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-text-muted)]">Provider</label>
            <Input name="provider" defaultValue="internal" />
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-text-muted)]">Tipo</label>
            <Select name="reconciliation_type" defaultValue="full"><option value="full">Full</option><option value="payments">Payments</option><option value="wallet">Wallet</option><option value="ad_spend">Ad spend</option></Select>
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-text-muted)]">Organization ID opcional</label>
            <Input name="organization_id" placeholder="uuid opcional" />
            <Button type="submit" className="w-full">Crear run</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-[var(--admin-text)]">Runs recientes</h2>
          <TableWrap className="mt-4">
            <Table>
              <thead><tr><Th>Run</Th><Th>Cliente</Th><Th>Tipo</Th><Th>Estado</Th><Th>Issues</Th></tr></thead>
              <tbody className="divide-y divide-[var(--admin-table-divider)]">
                {runs.map(({ row, organization, items: runItems }) => (
                  <tr key={row.id}>
                    <Td><p className="font-mono text-xs font-semibold text-[var(--admin-text)]">{row.id}</p><p className="text-xs text-[var(--admin-text-muted)]">{formatDateTime(row.started_at)}</p></Td>
                    <Td>{organization?.name ?? "Global"}</Td>
                    <Td>{row.provider} / {row.reconciliation_type}</Td>
                    <Td><StatusBadge status={row.status} /></Td>
                    <Td className="font-semibold text-[var(--admin-text)]">{runItems.length}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
      <Card className="mt-6 p-5">
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">Items recientes</h2>
        <TableWrap className="mt-4">
          <Table>
            <thead><tr><Th>Item</Th><Th>Cliente</Th><Th>Referencia</Th><Th>Estado</Th><Th>Montos</Th></tr></thead>
            <tbody className="divide-y divide-[var(--admin-table-divider)]">
              {items.map(({ row, organization }) => (
                <tr key={row.id}>
                  <Td>{row.item_type}<p className="font-mono text-xs text-[var(--admin-text-muted)]">{row.id}</p></Td>
                  <Td>{organization?.name ?? "Global"}</Td>
                  <Td className="font-mono text-xs">{row.source_reference ?? row.ledger_journal_id ?? "—"}</Td>
                  <Td><StatusBadge status={row.status} /></Td>
                  <Td>{formatMoney(row.provider_amount_cents ?? 0, row.currency ?? "USD")} / {formatMoney(row.ledger_amount_cents ?? 0, row.currency ?? "USD")}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
      {runs[0] ? <div className="mt-6"><JsonPreview title="Totales último run" value={runs[0].row.totals} /></div> : null}
    </>
  );
}
