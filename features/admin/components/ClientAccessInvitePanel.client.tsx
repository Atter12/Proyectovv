"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";

interface InviteRow {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
}

interface ClientAccessInvitePanelProps {
  organizationId: string;
  clientLabel: string;
  initialInvites: InviteRow[];
}

export function ClientAccessInvitePanel({
  organizationId,
  clientLabel,
  initialInvites,
}: ClientAccessInvitePanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState(initialInvites);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await apiClient<{ ok: boolean; invite: InviteRow }>(
        "/api/admin/client-invites",
        {
          method: "POST",
          body: JSON.stringify({ organizationId, email }),
        },
      );
      setInvites((prev) => {
        const without = prev.filter(
          (item) => item.email.toLowerCase() !== result.invite.email.toLowerCase(),
        );
        return [result.invite, ...without];
      });
      setEmail("");
      setInfo(
        `Listo. Cuando ${result.invite.email} se registre con ese correo y su contraseña, entra automático a los datos de ${clientLabel}.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "No se pudo invitar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiClient(
        `/api/admin/client-invites?inviteId=${encodeURIComponent(inviteId)}&organizationId=${encodeURIComponent(organizationId)}`,
        { method: "DELETE" },
      );
      setInvites((prev) =>
        prev.map((item) =>
          item.id === inviteId ? { ...item, status: "revoked" } : item,
        ),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "No se pudo revocar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold text-[var(--admin-text)]">
        Acceso por correo
      </h2>
      <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
        Mapeá el correo del cliente (el de tu otro sistema). Ellos ponen{" "}
        <strong>correo + contraseña</strong> al registrarse y se abren solo los datos de{" "}
        {clientLabel}.
      </p>

      <form onSubmit={handleInvite} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ely@ejemplo.com"
          className="flex-1"
        />
        <Button type="submit" disabled={busy} className="sm:w-auto">
          {busy ? "Guardando…" : "Dar acceso"}
        </Button>
      </form>

      {error && (
        <p className="mt-3 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="mt-3 text-xs text-emerald-700" role="status">
          {info}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {invites.length === 0 ? (
          <li className="text-sm text-[var(--admin-text-muted)]">
            Aún no hay correos mapeados a este cliente.
          </li>
        ) : (
          invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-border)] py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--admin-text)]">{invite.email}</p>
                <p className="text-xs text-[var(--admin-text-muted)]">Rol: {invite.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    invite.status === "accepted"
                      ? "success"
                      : invite.status === "pending"
                        ? "info"
                        : "neutral"
                  }
                >
                  {invite.status === "pending"
                    ? "Pendiente"
                    : invite.status === "accepted"
                      ? "Ya entró"
                      : "Revocado"}
                </Badge>
                {invite.status === "pending" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => handleRevoke(invite.id)}
                  >
                    Revocar
                  </Button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
