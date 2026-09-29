import "server-only";

/**
 * En Ads Holistic todos son prepago. El link de Hecom no abre crédito.
 */
export async function isAgencyCreditCliente(
  _hecomClienteIdRaw?: string,
): Promise<boolean> {
  return false;
}
