import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table, TableWrap, Td, Th } from "@/components/ui/Table";
import { listIntegrations } from "@/lib/admin/data";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const { connections, apiKeys } = await listIntegrations();
  return (
    <>
      <AdminPageHeader eyebrow="Conectividad" title="Integraciones y API keys" description="Conexiones por organización, scopes, último sync y llaves emitidas sin exponer secretos." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-black text-[#061925]">Conexiones</h2>
          <TableWrap>
            <Table>
              <thead><tr><Th>Conexión</Th><Th>Cliente</Th><Th>Scopes</Th><Th>Estado</Th></tr></thead>
              <tbody className="divide-y divide-[#e4eef3]">
                {connections.map(({ row, organization }) => (
                  <tr key={row.id}>
                    <Td><p className="font-black text-[#061925]">{row.name}</p><p className="text-xs text-[#789bad]">{row.provider} · {row.external_account_id ?? "—"}</p></Td>
                    <Td>{organization?.name ?? "—"}</Td>
                    <Td><div className="flex flex-wrap gap-1">{(row.scopes ?? []).slice(0, 3).map((scope) => <Badge key={scope}>{scope}</Badge>)}</div></Td>
                    <Td><StatusBadge status={row.status} /><p className="text-xs text-[#789bad]">{formatDateTime(row.last_synced_at)}</p></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-black text-[#061925]">API keys</h2>
          <TableWrap>
            <Table>
              <thead><tr><Th>Key</Th><Th>Cliente</Th><Th>Scopes</Th><Th>Estado</Th></tr></thead>
              <tbody className="divide-y divide-[#e4eef3]">
                {apiKeys.map(({ row, organization }) => (
                  <tr key={row.id}>
                    <Td><p className="font-black text-[#061925]">{row.name}</p><p className="font-mono text-xs text-[#789bad]">{row.key_prefix}••••</p></Td>
                    <Td>{organization?.name ?? "—"}</Td>
                    <Td><div className="flex flex-wrap gap-1">{(row.scopes ?? []).slice(0, 3).map((scope) => <Badge key={scope}>{scope}</Badge>)}</div></Td>
                    <Td><StatusBadge status={row.status} /><p className="text-xs text-[#789bad]">Último uso {formatDateTime(row.last_used_at)}</p></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    </>
  );
}
