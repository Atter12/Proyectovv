import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listUsers } from "@/lib/admin/data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "all";
  const users = await listUsers({ q, status });

  return (
    <>
      <AdminPageHeader eyebrow="Identidad" title="Usuarios" description="Perfiles Supabase, estado de verificación y membresías por organización." />
      <Card className="p-5">
        <form className="mb-5 grid gap-3 md:grid-cols-[1fr_13rem_auto]">
          <Input name="q" defaultValue={q} placeholder="Buscar por correo, nombre o teléfono…" />
          <Select name="status" defaultValue={status}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="email_pending">Email pendiente</option>
            <option value="suspended">Suspendidos</option>
          </Select>
          <Button type="submit" variant="secondary">Filtrar</Button>
        </form>
        <TableWrap>
          <Table>
            <thead><tr><Th>Usuario</Th><Th>Estado</Th><Th>Onboarding</Th><Th>Organizaciones</Th><Th>Última actividad</Th></tr></thead>
            <tbody className="divide-y divide-[#e4eef3]">
              {users.map(({ row, memberships }) => (
                <tr key={row.id}>
                  <Td><p className="font-black text-[#061925]">{row.full_name ?? "Sin nombre"}</p><p className="text-xs text-[#789bad]">{row.email}</p></Td>
                  <Td><StatusBadge status={row.status ?? "unknown"} label={row.email_verified ? "Verificado" : row.status ?? "—"} /></Td>
                  <Td><Badge tone="neutral">{row.onboarding_status ?? "—"}</Badge></Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {memberships.slice(0, 3).map(({ row: membership, organization }) => <Badge key={membership.id} tone="purple">{organization?.name ?? membership.role}</Badge>)}
                      {memberships.length > 3 ? <Badge>+{memberships.length - 3}</Badge> : null}
                    </div>
                  </Td>
                  <Td>{formatDateTime(row.last_active_at ?? row.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
