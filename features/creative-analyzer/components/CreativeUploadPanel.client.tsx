"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";

interface CreativeUploadResponse {
  ok: boolean;
  asset: { id: string; name: string };
  job: { id: string; status: string };
}

export function CreativeUploadPanel() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) {
      setError("Selecciona una imagen, video o PDF.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("asset", file);
      if (name.trim()) formData.append("name", name.trim());

      const response = await apiClient<CreativeUploadResponse>("/api/creative-assets", {
        method: "POST",
        body: formData,
      });

      setSuccess(`Creativo ${response.asset.name} subido. Job ${response.job.status}.`);
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
    <Card className="overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="p-5 sm:p-6">
          <span className="inline-flex rounded-full bg-[var(--brand-primary)]/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-[var(--brand-primary)]">
            Upload real
          </span>
          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-[#0f172a]">
            Sube creativos y deja el job preparado
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748b]">
            Este flujo guarda el archivo en Storage, crea el registro en
            creative_assets y deja un creative_analysis_job en cola. La IA real
            puede conectarse después sin cambiar la experiencia del cliente.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold text-[#64748b]">
                Nombre visible
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Hook descuento verano"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold text-[#64748b]">
                Archivo creativo
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-2xl border border-[#dbe1ea] bg-white px-3 py-2.5 text-sm text-[#0f172a] file:mr-3 file:rounded-xl file:border-0 file:bg-[#eef2ff] file:px-3 file:py-1.5 file:text-xs file:font-black file:text-[var(--brand-primary)]"
              />
              <p className="mt-1 text-xs text-[#94a3b8]">
                Máximo 50 MB. Formatos: imagen, video o PDF.
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-[#fef2f2] px-3 py-2 text-sm text-[#991b1b]" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-4 rounded-2xl bg-[#ecfdf5] px-3 py-2 text-sm text-[#047857]">
              {success}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleUpload} disabled={loading} size="lg">
              {loading ? "Subiendo…" : "Subir y crear job"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setName("");
                setFile(null);
                setError(null);
                setSuccess(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={loading}
            >
              Limpiar
            </Button>
          </div>
        </div>

        <div className="border-t border-[#e5e7eb] bg-slate-950 p-5 text-white sm:p-6 lg:border-l lg:border-t-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
            Estado operativo
          </p>
          <div className="mt-5 space-y-4">
            {[
              "Archivo privado en Storage",
              "creative_asset registrado",
              "Job en cola",
              "Historial visible",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#12d6a3]/15 text-xs font-black text-[#12d6a3]">
                  ✓
                </span>
                <span className="text-sm font-semibold text-white/80">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
