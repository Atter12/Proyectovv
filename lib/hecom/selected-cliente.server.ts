import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";
import { getSession } from "@/lib/auth/session.server";
import { sessionIsGerente } from "@/lib/auth/tester-dashboard-mode.server";
import {
  isHecomOtpLoginEnabled,
  resolveHecomClientesForEmail,
  userMayAccessHecomCliente,
} from "@/lib/auth/hecom-otp.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";

export const HECOM_CLIENTE_COOKIE_ID = "vv_hecom_cliente_id";
export const HECOM_CLIENTE_COOKIE_NAME = "vv_hecom_cliente_name";
export const HECOM_CLIENTE_COOKIE_OWNER = "vv_hecom_cliente_owner";
export const HECOM_ACT_AS_CLIENTE_COOKIE = "vv_hecom_act_as_cliente";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export type SelectedHecomCliente = {
  id: string;
  name: string;
};

/**
 * Cliente activo en el panel.
 * Scope por usuario: al cambiar de cuenta (cliente ↔ gerente) no se reutiliza
 * la selección del otro.
 *
 * La cookie solo se fija al hacer login. Si se pierde (otro navegador, cookies
 * borradas) y la sesión sigue viva, el cliente quedaba con el panel vacío: en
 * ese caso se usa su única ficha vinculada (hecom_cliente_user_links).
 * Gerentes no tienen fichas vinculadas: siguen eligiendo del CRM.
 *
 * La cookie la puede editar el propio navegador: un cliente podía apuntarla a
 * la ficha de otro y operar su cartera. Por eso cada lectura vuelve a validar
 * que la sesión tenga acceso a esa ficha (misma regla que /api/clientes/seleccionar).
 * Si no lo tiene, se trata como si no hubiera nada elegido.
 */
export async function getSelectedHecomCliente(
  userId?: string | null,
): Promise<SelectedHecomCliente | null> {
  const store = await cookies();
  const id = store.get(HECOM_CLIENTE_COOKIE_ID)?.value?.trim() ?? "";
  const owner = store.get(HECOM_CLIENTE_COOKIE_OWNER)?.value?.trim() ?? "";
  if (!id || (userId && owner && owner !== userId)) {
    return userId ? resolveOnlyLinkedCliente(userId) : null;
  }

  if (!(await sessionMayUseHecomCliente(id))) {
    console.warn("[selected-cliente] cookie_cliente_denied", {
      userId: userId ?? null,
      clienteId: id,
    });
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

export async function getActingAsCliente(
  userId?: string | null,
): Promise<boolean> {
  const store = await cookies();
  const flag = store.get(HECOM_ACT_AS_CLIENTE_COOKIE)?.value?.trim();
  if (flag !== "1") return false;
  const owner = store.get(HECOM_CLIENTE_COOKIE_OWNER)?.value?.trim() ?? "";
  if (userId && owner && owner !== userId) return false;
  const id = store.get(HECOM_CLIENTE_COOKIE_ID)?.value?.trim() ?? "";
  if (!id) return false;
  // “Ver como” es solo de staff (la API lo exige al fijarlo). Una cookie puesta
  // a mano por un cliente no debe cambiar su vista ni su identidad.
  const access = await resolveSessionClienteAccess();
  return Boolean(access?.isStaffLike);
}

export async function setActingAsCliente(enabled: boolean): Promise<void> {
  const store = await cookies();
  const common = {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
  };
  if (enabled) {
    store.set(HECOM_ACT_AS_CLIENTE_COOKIE, "1", common);
    return;
  }
  store.delete(HECOM_ACT_AS_CLIENTE_COOKIE);
}

export async function clearSelectedHecomCliente(): Promise<void> {
  const store = await cookies();
  store.delete(HECOM_CLIENTE_COOKIE_ID);
  store.delete(HECOM_CLIENTE_COOKIE_NAME);
  store.delete(HECOM_CLIENTE_COOKIE_OWNER);
  store.delete(HECOM_ACT_AS_CLIENTE_COOKIE);
}

type SessionClienteAccess = {
  userId: string;
  email: string;
  /** Gerente o admin: puede ver cualquier ficha del CRM. */
  isStaffLike: boolean;
  isAdmin: boolean;
  isStaff: boolean;
};

/** Quién es la sesión actual a efectos de fichas Hecom. Memo por request. */
const resolveSessionClienteAccess = cache(
  async (): Promise<SessionClienteAccess | null> => {
    const session = await getSession();
    if (!session) return null;
    const isAdmin = userIsAllowedAdmin({ id: session.id, email: session.email });
    const isStaff = await sessionIsGerente(session.email);
    return {
      userId: session.id,
      email: session.email,
      isStaffLike: isAdmin || isStaff,
      isAdmin,
      isStaff,
    };
  },
);

/**
 * ¿La sesión actual puede usar esta ficha Hecom?
 * Staff/admin: cualquiera. Cliente: sus fichas vinculadas al hacer login
 * (hecom_cliente_user_links, escritas solo por el servidor) o las del CRM por
 * su correo, con la misma regla que usa la selección (userMayAccessHecomCliente).
 */
const sessionMayUseHecomCliente = cache(
  async (clienteId: string): Promise<boolean> => {
    const access = await resolveSessionClienteAccess();
    if (!access) return false;
    if (access.isStaffLike) return true;

    try {
      const { data } = await createAdminClient()
        .from("hecom_cliente_user_links")
        .select("hecom_cliente_id")
        .eq("user_id", access.userId)
        .eq("hecom_cliente_id", clienteId)
        .limit(1);
      if ((data ?? []).length > 0) return true;
    } catch (error) {
      console.warn("[selected-cliente] link_check_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    let linkedClienteIds: string[] = [];
    if (isHecomOtpLoginEnabled()) {
      try {
        const allowed = await resolveHecomClientesForEmail(access.email);
        linkedClienteIds = allowed.map((item) => item.id);
      } catch (error) {
        // Si el CRM no responde, negar: mejor panel vacío que cartera ajena.
        console.warn("[selected-cliente] crm_check_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    }
    return userMayAccessHecomCliente({
      isAdmin: access.isAdmin,
      isStaff: access.isStaff,
      linkedClienteIds,
      clienteId,
    });
  },
);

/** Única ficha Hecom vinculada al usuario (cliente con login). null si tiene 0 o varias. */
async function resolveOnlyLinkedCliente(userId: string): Promise<SelectedHecomCliente | null> {
  try {
    const { data } = await createAdminClient()
      .from("hecom_cliente_user_links")
      .select("hecom_cliente_id")
      .eq("user_id", userId)
      .limit(2);
    const ids = [...new Set((data ?? []).map((r) => String(r.hecom_cliente_id ?? "")).filter(Boolean))];
    if (ids.length !== 1) return null;
    const { data: cliente } = await createHecomAdminClient()
      .from("clientes")
      .select("name")
      .eq("id", ids[0]!)
      .maybeSingle<{ name: string | null }>();
    return { id: ids[0]!, name: String(cliente?.name ?? "").trim() || "Cliente Hecom" };
  } catch (error) {
    console.warn("[selected-cliente] linked_fallback_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
