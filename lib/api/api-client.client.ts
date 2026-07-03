export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Error en la solicitud";
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      message = data.error ?? data.message ?? message;
    } catch {
      if (response.status === 503) {
        message =
          "El servidor no está configurado para producción. Contacta al administrador.";
      } else if (response.status >= 500) {
        message = "Error interno del servidor. Intenta de nuevo más tarde.";
      }
    }
    throw new ApiClientError(message, response.status);
  }

  return response.json() as Promise<T>;
}
