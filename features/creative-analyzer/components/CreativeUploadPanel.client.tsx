"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";

interface CreativeUploadResponse {
  ok: boolean;
  asset: { id: string; name: string };
  job: { id: string; status: string };
}

const ACCEPT = "image/*,video/*,application/pdf";
const MAX_MB = 50;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind(file: File): "image" | "video" | "pdf" | "other" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  return "other";
}

export function CreativeUploadPanel({
  clienteName,
}: {
  clienteName?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFile = useCallback((next: File | null) => {
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo supera ${MAX_MB} MB.`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError(null);
    setSuccess(null);
    setFile(next);
  }, []);

  function clearForm() {
    setName("");
    setFile(null);
    setError(null);
    setSuccess(null);
    setDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!file) {
      setError("Seleccioná una imagen, video o PDF.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("asset", file);
      const label =
        name.trim() ||
        (clienteName ? `${clienteName} · ${file.name}` : file.name);
      formData.append("name", label);

      const response = await apiClient<CreativeUploadResponse>(
        "/api/creative-assets",
        {
          method: "POST",
          body: formData,
        },
      );

      setSuccess(
        `“${response.asset.name}” subido. Job ${response.job.status} — listo para análisis.`,
      );
      setName("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof ApiClientError
          ? requestError.message
          : "No se pudo subir el creativo.",
      );
    } finally {
      setLoading(false);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!dragging) setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    pickFile(dropped);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const kind = file ? fileKind(file) : null;

  return (
    <section
      id="creative-upload"
      className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
          Análisis
        </p>
        <h2 className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
          Subir creativo para analizar
        </h2>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
          Guardamos el archivo, creamos el asset y dejamos un job en cola
          {clienteName ? ` · contexto: ${clienteName}` : ""}.
        </p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
                Nombre visible
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={
                  clienteName
                    ? `Ej. Hook ${clienteName}`
                    : "Ej. Hook descuento verano"
                }
                className="h-10 border-[rgb(20_18_16_/_0.1)] text-[13px]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
                Archivo
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                onChange={(event) =>
                  pickFile(event.target.files?.[0] ?? null)
                }
              />

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={onDragOver}
                onDragEnter={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn(
                  "group relative cursor-pointer rounded-[1.1rem] border border-dashed px-4 py-5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]/35",
                  dragging
                    ? "border-[var(--auth-accent)] bg-[rgb(255_248_243_/_0.9)]"
                    : file
                      ? "border-[rgb(20_18_16_/_0.12)] bg-white"
                      : "border-[rgb(20_18_16_/_0.14)] bg-[rgb(255_248_243_/_0.55)] hover:border-[rgb(255_120_31_/_0.35)] hover:bg-[rgb(255_248_243_/_0.85)]",
                )}
              >
                {file ? (
                  <div className="flex items-start gap-3">
                    <FileKindIcon kind={kind ?? "other"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
                        {file.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--auth-text-muted)]">
                          {kind === "image"
                            ? "Imagen"
                            : kind === "video"
                              ? "Video"
                              : kind === "pdf"
                                ? "PDF"
                                : "Archivo"}
                        </span>
                        <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--auth-text-muted)]">
                          {formatBytes(file.size)}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] text-[var(--auth-text-muted)]">
                        Clic para cambiar · o soltá otro archivo
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--auth-text-soft)] transition-colors hover:bg-[rgb(20_18_16_/_0.05)] hover:text-[var(--auth-text)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        pickFile(null);
                        if (fileInputRef.current)
                          fileInputRef.current.value = "";
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
                    <span className="mb-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-[rgb(20_18_16_/_0.08)] sm:mb-0">
                      <UploadGlyph />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
                        {dragging
                          ? "Soltá el archivo acá"
                          : "Arrastrá el creativo o elegilo"}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                        Imagen, video o PDF · máx. {MAX_MB} MB
                      </p>
                      <span className="mt-3 inline-flex h-8 items-center rounded-lg bg-[#0f0e0c] px-3 text-[12px] font-bold text-white transition-colors group-hover:bg-[#1a1816]">
                        Elegir archivo
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error ? (
            <p
              className="mt-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#991b1b]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mt-3 rounded-lg bg-[#ecf7f0] px-3 py-2 text-[13px] text-[#1f5c40]">
              {success}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={handleUpload}
              disabled={loading}
              className="h-11 rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.28)] hover:brightness-[1.05]"
            >
              {loading ? "Subiendo…" : "Subir y encolar análisis"}
            </Button>
            <Button
              variant="outline"
              onClick={clearForm}
              disabled={loading}
              className="h-11 rounded-xl border-[rgb(20_18_16_/_0.12)] px-4 text-[14px] font-semibold text-[var(--auth-text)] hover:bg-[rgb(255_248_243_/_0.7)]"
            >
              Limpiar
            </Button>
          </div>
        </div>

        <aside className="border-t border-[rgb(20_18_16_/_0.06)] bg-[rgb(255_248_243_/_0.65)] px-5 py-4 sm:px-6 sm:py-5 lg:border-l lg:border-t-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-text-soft)]">
            Qué hace este flujo
          </p>
          <ul className="mt-3 space-y-2.5">
            {[
              "Archivo privado en Storage",
              "Registro en creative_assets",
              "Job de análisis en cola",
              "Listo para conectar scoring IA",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-[12px] font-medium leading-4 text-[var(--auth-text-muted)]"
              >
                <span
                  aria-hidden
                  className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--auth-accent)]"
                />
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

function UploadGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-[var(--auth-accent)]"
      fill="none"
      aria-hidden
    >
      <path
        d="M12 15.5V4.75M12 4.75 8.5 8.25M12 4.75l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 14.5v2.75A2.75 2.75 0 0 0 7.75 20h8.5A2.75 2.75 0 0 0 19 17.25V14.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileKindIcon({
  kind,
}: {
  kind: "image" | "video" | "pdf" | "other";
}) {
  const tone =
    kind === "image"
      ? "bg-[#ecf7f0] text-[#1f5c40]"
      : kind === "video"
        ? "bg-[rgb(255_120_31_/_0.12)] text-[var(--auth-accent)]"
        : kind === "pdf"
          ? "bg-[#f0f4f8] text-[#334e68]"
          : "bg-[rgb(20_18_16_/_0.05)] text-[var(--auth-text-muted)]";

  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
        tone,
      )}
      aria-hidden
    >
      {kind === "image" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <rect
            x="4"
            y="5"
            width="16"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="9" cy="10" r="1.4" fill="currentColor" />
          <path
            d="m7.5 16 3.2-3.4 2.3 2.2L16 12.2 18.5 16"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : kind === "video" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <rect
            x="3.5"
            y="6"
            width="12.5"
            height="12"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M16 10.2 20.5 7.5v9L16 13.8v-3.6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path
            d="M7 3.5h7.2L19 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M14 3.5V8h5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9 13h6M9 16.5h4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}
