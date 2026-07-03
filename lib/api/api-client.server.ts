import { serverEnv } from "@/lib/env/env.server";

interface ServerFetchOptions extends RequestInit {
  path: string;
}

/**
 * Cliente HTTP server-side hacia el backend privado (futuro).
 * Los Client Components nunca deben usar este módulo.
 */
export async function apiClientServer<T>(
  options: ServerFetchOptions,
): Promise<T> {
  const { path, ...init } = options;

  if (!serverEnv.apiBaseUrl) {
    throw new Error(
      "[api-client.server] API_BASE_URL no configurada. Usa servicios mock en desarrollo.",
    );
  }

  const url = `${serverEnv.apiBaseUrl.replace(/\/$/, "")}${path}`;
  const headers = new Headers(init.headers);

  if (serverEnv.apiKey) {
    headers.set("Authorization", `Bearer ${serverEnv.apiKey}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`[api-client.server] ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}
