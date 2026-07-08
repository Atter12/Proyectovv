import { reverseJournalAction } from "@/lib/admin/actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JsonPreview } from "@/components/admin/JsonPreview";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listLedger } from "@/lib/admin/data";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const journals = await listLedger({ q, status });

  return (
    <>
      <AdminPageHeader eyebrow="Contabilidad" title="Ledger" description="Journals de doble partida, entries relacionadas y reversas controladas por RPC." />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por journal, tipo, source, referencia o cliente…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Todos</option>
            <option value="posted">Posted</option>
            <option value="draft">Draft</option>
            <option value="reversed">Reversed</option>
            <option value="void">Void</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <div className="space-y-4">
          {journals.map(({ row, organization, wallet, entries }) => (
            <section key={row.id} className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-black text-slate-950">{row.id}</p><StatusBadge status={row.status} /></div>
                  <p className="mt-1 text-sm text-slate-500">{organization?.name ?? "—"} · {wallet?.name ?? row.wallet_id} · {formatDateTime(row.created_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-2"><Badge tone="purple">{row.journal_type}</Badge>{row.source_table ? <Badge>{row.source_table}</Badge> : null}{row.provider ? <Badge tone="info">{row.provider}</Badge> : null}</div>
                </div>
                <div className="text-right"><p className="text-2xl font-black text-slate-950">{formatMoney(row.amount_cents, row.currency)}</p><p className="text-xs text-slate-400">{row.description ?? row.provider_reference ?? "sin descripción"}</p></div>
              </div>
              {entries.length > 0 ? (
                <TableWrap className="mt-4">
                  <Table>
                    <thead><tr><Th>Entry</Th><Th>Cuenta</Th><Th>Dirección</Th><Th>Monto</Th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {entries.map((entry) => <tr key={entry.id}><Td className="font-mono text-xs">{entry.id}</Td><Td className="font-mono text-xs">{entry.account_id}</Td><Td><Badge tone={entry.direction === "debit" ? "info" : "warning"}>{entry.direction}</Badge></Td><Td className="font-black text-slate-950">{formatMoney(entry.amount_cents, entry.currency)}</Td></tr>)}
                    </tbody>
                  </Table>
                </TableWrap>
              ) : null}
              {row.status === "posted" ? (
                <form action={reverseJournalAction} className="mt-4 flex flex-col gap-2 md:flex-row">
                  <input type="hidden" name="id" value={row.id} />
                  <Input name="reason" placeholder="Motivo de reversa" />
                  <Button type="submit" variant="danger">Reversar</Button>
                </form>
              ) : null}
            </section>
          ))}
        </div>
        {journals[0] ? <div className="mt-6"><JsonPreview title="Metadata último journal" value={journals[0].row.metadata} /></div> : null}
      </Card>
    </>
  );
}
