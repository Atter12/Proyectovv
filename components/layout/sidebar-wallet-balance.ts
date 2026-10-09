type SidebarPersona = "cliente" | "gerente" | "super_admin";

/**
 * Organización de la cartera que se muestra en el sidebar.
 * Primero la del cliente seleccionado. La de la sesión solo si ese cliente
 * no tiene org propia (un gerente “viendo como” no debe imponer la suya).
 */
export function pickClienteWalletOrganizationId(
  resolvedClienteOrgId: string | null | undefined,
  sessionOrganizationId: string | null | undefined,
): string | null {
  const resolved = resolvedClienteOrgId?.trim() || null;
  if (resolved) return resolved;
  return sessionOrganizationId?.trim() || null;
}

/** Lectura terminada: sin fila de ledger el saldo real es 0. */
export function sidebarWalletCents(input: {
  availableBalanceCents: number | null | undefined;
}): number {
  return input.availableBalanceCents ?? 0;
}

export function showsHolisticSidebarBalance(input: {
  hasCliente: boolean;
  persona: SidebarPersona;
  actingAsCliente: boolean;
  walletBalanceCents: number | null | undefined;
  saldoEstimado: number | null | undefined;
}): boolean {
  if (!input.hasCliente) return false;
  return (
    input.persona === "cliente" ||
    input.actingAsCliente ||
    input.walletBalanceCents != null ||
    input.saldoEstimado == null
  );
}

/** null no es cero: la tarjeta muestra «…» para no inventar un saldo. */
export function sidebarBalanceIsUnknown(
  walletBalanceCents: number | null | undefined,
): boolean {
  return walletBalanceCents == null;
}
