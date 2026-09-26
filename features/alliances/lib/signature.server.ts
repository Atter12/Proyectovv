import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { parseRemoteEnvelope, type RemoteEnvelope } from "@/features/alliances/lib/signature";

export interface SignatureSignerInput {
  name: string;
  email: string;
  countryCode: string;
  phone: string;
  page: number;
  slot: number;
}

export interface SendSignatureInput {
  contractId: string;
  name: string;
  pdf: Uint8Array;
  deadline: string;
  signers: SignatureSignerInput[];
}

interface TokenCache {
  access: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export function signatureProviderReady(): boolean {
  return Boolean(serverEnv.firmeasyIntegrationToken && serverEnv.firmeasyEmail && serverEnv.firmeasyPassword);
}

export async function sendSignatureEnvelope(input: SendSignatureInput): Promise<{ ok: true; envelope: RemoteEnvelope } | { ok: false; error: string }> {
  if (!signatureProviderReady()) {
    return { ok: false, error: "FirmEasy no está conectado. Faltan el token, el correo o la contraseña de la integración." };
  }
  const access = await accessToken();
  if (!access.ok) return access;

  const response = await fetch(`${baseUrl()}/v1/documents`, {
    method: "POST",
    headers: jsonHeaders(access.token),
    body: JSON.stringify({
      name: input.name,
      external_id: input.contractId,
      document_pdf_base64: Buffer.from(input.pdf).toString("base64"),
      sender_name: "Holistic Marketing",
      send_automatic_invitations: true,
      is_rejection_allowed: true,
      reminder_every_n_days: 3,
      ...(input.deadline ? { signature_deadline: input.deadline } : {}),
      signers: input.signers.map((signer) => {
        const width = Math.min(36, Math.floor(84 / Math.max(input.signers.length, 1)));
        return {
          name: signer.name,
          email: signer.email,
          country_code: signer.countryCode,
          phone: signer.phone,
          role: "signer",
          standard_flow: ["holographic_signature", "otp_email"],
          placements: [
            {
              document_ref: "main",
              type: "signature",
              page_number: signer.page,
              relative_position_left: 8 + signer.slot * width,
              relative_position_bottom: 8,
              relative_size_width: width,
              relative_size_height: 8,
            },
          ],
        };
      }),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const payload = await readJson(response);
  if (!response.ok) return { ok: false, error: providerError(response.status, payload, "FirmEasy no pudo crear la solicitud de firma.") };
  const envelope = parseRemoteEnvelope(payload);
  if (!envelope) return { ok: false, error: "FirmEasy no devolvió el identificador del documento." };
  return { ok: true, envelope };
}

export async function fetchSignatureEnvelope(token: string): Promise<{ ok: true; envelope: RemoteEnvelope } | { ok: false; error: string }> {
  if (!signatureProviderReady()) {
    return { ok: false, error: "FirmEasy no está conectado." };
  }
  const access = await accessToken();
  if (!access.ok) return access;
  const response = await fetch(`${baseUrl()}/v1/documents/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${access.token}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await readJson(response);
  if (!response.ok) return { ok: false, error: providerError(response.status, payload, "No se pudo consultar el estado en FirmEasy.") };
  const envelope = parseRemoteEnvelope(payload);
  if (!envelope) return { ok: false, error: "FirmEasy no devolvió el estado del documento." };
  return { ok: true, envelope };
}

export async function downloadSignedPdf(url: string): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  const access = await accessToken();
  if (!access.ok) return access;
  const target = url.startsWith("http") ? url : `${baseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
  const response = await fetch(target, {
    headers: { Authorization: `Bearer ${access.token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) return { ok: false, error: "FirmEasy confirmó la firma, pero el PDF firmado todavía no se pudo descargar." };
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 5 || Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") {
    return { ok: false, error: "El archivo firmado que devolvió FirmEasy no es un PDF." };
  }
  return { ok: true, bytes };
}

function baseUrl(): string {
  return (serverEnv.firmeasyBaseUrl || "https://app.firmeasy.legal/api").replace(/\/$/, "");
}

function jsonHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function accessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return { ok: true, token: tokenCache.access };
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/v1/auth/${encodeURIComponent(serverEnv.firmeasyIntegrationToken)}/login`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        email: serverEnv.firmeasyEmail,
        password: serverEnv.firmeasyPassword,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, error: "No se pudo contactar a FirmEasy." };
  }
  const payload = await readJson(response);
  const access = payload && typeof payload === "object" ? String((payload as { access?: unknown }).access ?? "") : "";
  if (!response.ok || !access) {
    tokenCache = null;
    return { ok: false, error: response.status === 401 ? "Las credenciales de FirmEasy no son válidas." : "No se pudo autenticar en FirmEasy." };
  }
  const expiresIn = payload && typeof payload === "object" ? Number((payload as { expires_in?: unknown }).expires_in) : 3600;
  tokenCache = { access, expiresAt: now + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000 };
  return { ok: true, token: access };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function providerError(status: number, payload: unknown, fallback: string): string {
  if (status === 401) return "Las credenciales de FirmEasy no son válidas.";
  if (status === 422) return "FirmEasy no aceptó el documento. Revisa correo, celular y que el archivo sea un PDF.";
  if (status === 429) return "FirmEasy está recibiendo demasiadas solicitudes. Inténtalo de nuevo en un momento.";
  const message = payload && typeof payload === "object" ? textField(payload, "error") || textField(payload, "message") : "";
  return message ? `${fallback} ${message}`.slice(0, 240) : fallback;
}

function textField(payload: object, key: string): string {
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
