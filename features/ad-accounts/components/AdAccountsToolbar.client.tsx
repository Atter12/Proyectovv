"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { routes } from "@/config/routes";
import { AdAccountsTable } from "./AdAccountsTable";
import type { AdAccount, AdAccountStatus } from "@/types/ad-account";

const statusOptions: { value: AdAccountStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Activa" },
  { value: "pending", label: "Pendiente" },
  { value: "suspended", label: "Suspendida" },
  { value: "inactive", label: "Inactiva" },
];

interface AdAccountsToolbarProps {
  accounts: AdAccount[];
}

export function AdAccountsToolbar({ accounts }: AdAccountsToolbarProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdAccountStatus | "all">("all");

  const filtered = useMemo(() => {
    return accounts.filter((account) => {
      const matchesSearch =
        search === "" ||
        account.id.toLowerCase().includes(search.toLowerCase()) ||
        account.bcId.toLowerCase().includes(search.toLowerCase()) ||
        account.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = status === "all" || account.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [accounts, search, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Buscar por ID de cuenta"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AdAccountStatus | "all")}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Link href={routes.creativeAnalyzer}>
            <Button variant="outline">Analizador creativo</Button>
          </Link>
          <Button>Crear nuevo</Button>
        </div>
      </div>
      <AdAccountsTable accounts={filtered} />
    </div>
  );
}
