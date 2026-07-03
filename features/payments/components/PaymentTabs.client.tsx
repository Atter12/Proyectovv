"use client";

import { useMemo, useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type { PaymentOverview } from "@/types/payment";

interface PaymentTabsProps {
  data: PaymentOverview;
}

function AssignmentTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Buscar cuenta publicitaria"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="pending">Pendiente</option>
        </select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cuenta publicitaria</TableHead>
            <TableHead>Estado de la cuenta publicitaria</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead>Recarga automática</TableHead>
            <TableHead>Información de umbral</TableHead>
            <TableHead>Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody />
      </Table>
      <EmptyState />
    </div>
  );
}

function EmptyHistoryTab({ label }: { label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-500">{label}</p>
      <EmptyState />
    </div>
  );
}

export function PaymentTabs({ data }: PaymentTabsProps) {
  const tabs = useMemo(
    () => [
      {
        id: "assignment",
        label: "Asignación de saldo",
        content: <AssignmentTab />,
      },
      {
        id: "account-tx",
        label: "Historial de transacciones de la cuenta publicitaria",
        content: (
          <EmptyHistoryTab label="Transacciones de cuentas publicitarias" />
        ),
      },
      {
        id: "wallet-tx",
        label: "Historial de transacciones de la billetera Default",
        content: <EmptyHistoryTab label="Transacciones de Cartera Default" />,
      },
      {
        id: "refunds",
        label: "Historial de reembolsos",
        content: <EmptyHistoryTab label="Reembolsos procesados" />,
      },
    ],
    [],
  );

  void data;

  return <Tabs tabs={tabs} />;
}
