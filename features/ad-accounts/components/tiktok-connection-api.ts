export type TikTokAccount = { id: string; name: string; bcId: string; bm: string; status?: string };
export type TikTokProfile = { id: string; assetId: string; name: string; bcId: string; createdAt: string };
export type TikTokFailure = { error: string; detail?: string; code?: string; status?: number; required?: string; endpoint?: string; providerCode?: number; requestId?: string };
export type TikTokResult = { advertiserId: string; ok: boolean; error?: TikTokFailure };
export type TikTokVerification = { linked: boolean; assignedIds: string[]; verifiedAt: string };
export type TikTokCheck = { state: "checking" } | { state: "checked"; value: TikTokVerification } | { state: "error"; failure: TikTokFailure };
export type TikTokSnapshot = { accounts: TikTokAccount[]; manageableAccounts: TikTokAccount[]; profiles: TikTokProfile[] };

/** One confirmation in the UI; bounded, individually verified requests to TikTok. */
export async function unassignTikTokAccounts(profileId: string, advertiserIds: string[], onProgress: (results: TikTokResult[], total: number) => void): Promise<TikTokResult[]> {
  const ids = [...new Set(advertiserIds)];
  const results: TikTokResult[] = [];
  let interrupted: TikTokFailure | undefined;
  for (const advertiserId of ids) {
    if (interrupted) {
      results.push({ advertiserId, ok: false, error: interrupted });
      continue;
    }
    try {
      await tiktokCall({ action: "unassign", profileId, advertiserIds: [advertiserId], confirm: true });
      results.push({ advertiserId, ok: true });
    } catch (error) {
      const failure = tiktokFailure(error);
      results.push({ advertiserId, ok: false, error: failure });
      // A lost response can hide a completed write. Reconcile before retrying;
      // don't keep starting requests while the connection or session is down.
      if (["NETWORK_ERROR", "REQUEST_TIMEOUT", "INVALID_RESPONSE"].includes(failure.code ?? "") || failure.status === 401 || failure.status === 403) {
        interrupted = { error: "Esta cuenta quedó pendiente porque se interrumpió la operación. Comprueba la conexión y reintenta las cuentas pendientes.", code: "BATCH_INTERRUPTED" };
      }
    }
    onProgress([...results], ids.length);
  }
  return results;
}

export function tiktokFailure(error: unknown): TikTokFailure {
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error as TikTokFailure;
  return { error: error instanceof Error ? error.message : "No pudimos completar la operación. Inténtalo de nuevo." };
}

export async function tiktokCall<T>(body?: object, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch("/api/integrations/tiktok/qr", {
      method: body ? "POST" : "GET", cache: "no-store", signal: controller.signal,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (!data || typeof data !== "object") throw { error: "La respuesta no se pudo leer. Recarga la página; si continúa, contacta a soporte.", status: response.status, code: "INVALID_RESPONSE" };
    if (!response.ok) throw { ...tiktokFailure(data), status: response.status };
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) throw { error: signal?.aborted ? "Consulta cancelada." : "La consulta tardó demasiado. Reintenta para comprobar el estado antes de continuar.", code: signal?.aborted ? "REQUEST_CANCELLED" : "REQUEST_TIMEOUT" };
    if (error instanceof TypeError) throw { error: "No pudimos conectar con Adsholistic. Revisa tu conexión y vuelve a intentarlo.", code: "NETWORK_ERROR" };
    throw tiktokFailure(error);
  } finally {
    clearTimeout(timer); signal?.removeEventListener("abort", cancel);
  }
}
