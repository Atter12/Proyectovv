import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { listOrganizations } from "@/lib/admin/data";
import { formatDateTime, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const organizations = await listOrganizations({ q, status });

  return (
    <>
      <AdminPageHeader
        eyebrow="Clientes"
        title="Organizaciones"
        description="Visión operativa de clientes, wallets, usuarios activos y cuentas publicitarias sin mezclarlo con el dashboard del cliente."
      />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por nombre, slug, razón social, RUC o correo…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="suspended">Suspendidas</option>
            <option value="archived">Archivadas</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <TableWrap>
          <Table>
            <thead><tr><Th>Organización</Th><Th>Wallet</Th><Th>Miembros</Th><Th>Cuentas Ads</Th><Th>Estado</Th><Th></Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {organizations.map(({ row, wallets, activeMembers, adAccountCount }) => {
                const wallet = wallets[0];
                return (
                  <tr key={row.id}>
                    <Td>
                      <Link href={`/admin/organizations/${row.id}`} className="font-black text-slate-950 hover:text-indigo-600">{row.name}</Link>
                      <p className="text-xs text-slate-400">/{row.slug} · {formatDateTime(row.created_at)}</p>
                    </Td>
                    <Td>{wallet ? <span className="font-black text-slate-950">{formatMoney(wallet.balance_cents, wallet.currency)}</span> : "—"}<p className="text-xs text-slate-400">{wallet?.status ?? "sin wallet"}</p></Td>
                    <Td className="font-black text-slate-950">{activeMembers}</Td>
                    <Td className="font-black text-slate-950">{adAccountCount}</Td>
                    <Td><StatusBadge status={row.status} /></Td>
                    <Td><Button asChild href={`/admin/organizations/${row.id}`} variant="secondary" size="sm">Abrir</Button></Td>
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
