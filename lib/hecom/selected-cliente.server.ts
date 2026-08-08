import "server-only";
import { cookies } from "next/headers";

export const HECOM_CLIENTE_COOKIE_ID = "vv_hecom_cliente_id";
export const HECOM_CLIENTE_COOKIE_NAME = "vv_hecom_cliente_name";
export const HECOM_CLIENTE_COOKIE_OWNER = "vv_hecom_cliente_owner";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SelectedHecomCliente = {
  id: string;
  name: string;
};

/**
 * Cliente activo en el panel.
 * Scope por usuario: al cambiar de cuenta (cliente ↔ gerente) no se reutiliza
 * la selección del otro.
 */
export async function getSelectedHecomCliente(
  userId?: string | null,
): Promise<SelectedHecomCliente | null> {
  const store = await cookies();
  const id = store.get(HECOM_CLIENTE_COOKIE_ID)?.value?.trim() ?? "";
  if (!id) return null;

  const owner = store.get(HECOM_CLIENTE_COOKIE_OWNER)?.value?.trim() ?? "";
  if (userId && owner && owner !== userId) {
    return null;
  }

  const name =
    store.get(HECOM_CLIENTE_COOKIE_NAME)?.value?.trim() || "Cliente Hecom";
  return { id, name };
}

export async function setSelectedHecomCliente(input: {
  id: string;
  name: string;
  userId?: string | null;
}): Promise<void> {
  const store = await cookies();
  const id = input.id.trim();
  const name = input.name.trim() || "Cliente Hecom";
  if (!id) return;

  const common = {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
  };

  store.set(HECOM_CLIENTE_COOKIE_ID, id, common);
  store.set(HECOM_CLIENTE_COOKIE_NAME, name.slice(0, 120), common);
  if (input.userId) {
    store.set(HECOM_CLIENTE_COOKIE_OWNER, input.userId, common);
  }
}

export async function clearSelectedHecomCliente(): Promise<void> {
  const store = await cookies();
  store.delete(HECOM_CLIENTE_COOKIE_ID);
  store.delete(HECOM_CLIENTE_COOKIE_NAME);
  store.delete(HECOM_CLIENTE_COOKIE_OWNER);
}
