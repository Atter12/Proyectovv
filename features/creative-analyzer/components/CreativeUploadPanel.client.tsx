"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";

interface CreativeUploadResponse {
  ok: boolean;
  asset: { id: string; name: string };
  job: { id: string; status: string };
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
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section
      id="creative-upload"
      className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]"
    >
      <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8a5a38]">
          Análisis
        </p>
        <h2 className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-[#1a1612]">
          Subir creativo para analizar
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-[#6b645c]">
          Guardamos el archivo, creamos el asset y dejamos un job en cola
          {clienteName ? ` · contexto: ${clienteName}` : ""}.
        </p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#7a736a]">
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
                className="h-9 border-[rgb(20_18_16_/_0.1)] text-[13px]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#7a736a]">
                Archivo
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,application/pdf"
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
                className="block w-full rounded-lg border border-[rgb(20_18_16_/_0.1)] bg-white px-3 py-2 text-[13px] text-[#1a1612] file:mr-3 file:rounded-md file:border-0 file:bg-[#f0e9e0] file:px-2.5 file:py-1 file:text-[11px] file:font-medium file:text-[#5c564e]"
              />
              <p className="mt-1 text-[11px] text-[#9a9187]">
                Máx. 50 MB · imagen, video o PDF
                {file ? ` · ${file.name}` : ""}
              </p>
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
              className="h-9 rounded-lg bg-[#e85a1c] px-4 text-[13px] font-medium hover:bg-[#d14e16]"
            >
              {loading ? "Subiendo…" : "Subir y encolar análisis"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setName("");
                setFile(null);
                setError(null);
                setSuccess(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={loading}
              className="h-9 rounded-lg border-[rgb(20_18_16_/_0.12)] px-3 text-[13px] font-normal text-[#4a433c] hover:bg-[#f3eee8]"
            >
              Limpiar
            </Button>
          </div>
        </div>

        <aside className="border-t border-[rgb(20_18_16_/_0.06)] bg-[#faf7f3] px-5 py-4 sm:px-6 sm:py-5 lg:border-l lg:border-t-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#7a736a]">
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
                className="flex items-start gap-2 text-[12px] leading-4 text-[#5c564e]"
              >
                <span
                  aria-hidden
                  className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c45a18]"
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
