import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format-money";
import { routes } from "@/config/routes";
import type { Wallet } from "@/types/wallet";

interface WalletOverviewCardProps {
  wallet: Wallet;
}

export function WalletOverviewCard({ wallet }: WalletOverviewCardProps) {
  return (
    <Card className="relative h-full overflow-hidden transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <div
        className="absolute right-0 top-0 h-24 w-24 rounded-bl-[4rem] bg-[var(--brand-primary)]/[0.08]"
        aria-hidden
      />

      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--admin-text-muted,#64748b)]">
              {wallet.name}
            </p>
            <p className="text-xs text-[var(--admin-text-soft,#94a3b8)]">
              Saldo disponible
            </p>
          </div>
        </div>

        <p className="font-display text-[2rem] font-medium tracking-[-0.03em] text-[var(--foreground)]">
          {formatMoney(wallet.balance, wallet.currency)}
        </p>

        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--admin-text-muted,#64748b)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-text-soft,#94a3b8)]" />
          Sin recargas registradas
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={routes.payments}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--brand-primary-deep)] sm:flex-none"
          >
            Agregar saldo
          </Link>
          <Link
            href={routes.payments}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-white px-4 text-[13px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-soft)] sm:flex-none"
          >
            Ver pagos
          </Link>
        </div>
      </div>
    </Card>
  );
}
