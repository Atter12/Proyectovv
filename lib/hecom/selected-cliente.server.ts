import "server-only";
import { cookies } from "next/headers";

export const HECOM_CLIENTE_COOKIE_ID = "vv_hecom_cliente_id";
export const HECOM_CLIENTE_COOKIE_NAME = "vv_hecom_cliente_name";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SelectedHecomCliente = {
  id: string;
  name: string;
};

export async function getSelectedHecomCliente(): Promise<SelectedHecomCliente | null> {
  const store = await cookies();
  const id = store.get(HECOM_CLIENTE_COOKIE_ID)?.value?.trim() ?? "";
  if (!id) return null;
  const name =
    store.get(HECOM_CLIENTE_COOKIE_NAME)?.value?.trim() ||
    "Cliente Hecom";
  return { id, name };
}

export async function setSelectedHecomCliente(input: {
  id: string;
  name: string;
}): Promise<void> {
  const store = await cookies();
  const id = input.id.trim();
  const name = input.name.trim() || "Cliente Hecom";
  if (!id) return;

  store.set(HECOM_CLIENTE_COOKIE_ID, id, {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
  store.set(HECOM_CLIENTE_COOKIE_NAME, name.slice(0, 120), {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
}

export async function clearSelectedHecomCliente(): Promise<void> {
  const store = await cookies();
  store.delete(HECOM_CLIENTE_COOKIE_ID);
  store.delete(HECOM_CLIENTE_COOKIE_NAME);
}
