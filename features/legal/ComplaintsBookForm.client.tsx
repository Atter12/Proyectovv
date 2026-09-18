"use client";

import { useState, type FormEvent } from "react";
import { legalCompany } from "@/lib/legal/company";

type Receipt = { claimCode: string; createdAt: string };

export function ComplaintsBookForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/libro-reclamaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimType: form.get("claimType"),
          consumerName: form.get("consumerName"),
          documentType: form.get("documentType"),
          documentNumber: form.get("documentNumber"),
          address: form.get("address"),
          phone: form.get("phone"),
          email: form.get("email"),
          isMinor: form.get("isMinor") === "on",
          guardianName: form.get("guardianName"),
          product: form.get("product"),
          amountText: form.get("amountText"),
          detail: form.get("detail"),
          request: form.get("request"),
        }),
      });
      const json = (await response.json()) as {
        error?: string;
        claimCode?: string;
        createdAt?: string;
      };
      if (!response.ok || !json.claimCode || !json.createdAt) {
        setError(json.error || "No se pudo registrar.");
        return;
      }
      setReceipt({ claimCode: json.claimCode, createdAt: json.createdAt });
    } catch {
      setError("No se pudo registrar. Revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <div className="rounded-2xl border border-[#1f5c40]/20 bg-[#ecf7f0] p-4">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#1f5c40]">
          Constancia de registro
        </p>
        <p className="mt-2 text-[1.35rem] font-semibold">{receipt.claimCode}</p>
        <p className="mt-1 text-[14px]">
          Registrado el{" "}
          {new Date(receipt.createdAt).toLocaleString("es-PE", {
            timeZone: "America/Lima",
          })}
          . Guarda este código. {legalCompany.legalName} responderá en un plazo
          máximo de 15 días hábiles al correo que indicaste.
        </p>
      </div>
    );
  }

  const field =
    "mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-[14px]";

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-black/10 bg-white p-4">
      <label className="block text-[13px] font-semibold">
        Tipo
        <select name="claimType" className={field} defaultValue="reclamo">
          <option value="reclamo">Reclamo (disconformidad con el servicio)</option>
          <option value="queja">Queja (disconformidad con la atención)</option>
        </select>
      </label>
      <label className="block text-[13px] font-semibold">
        Nombre completo
        <input name="consumerName" required className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-semibold">
          Documento
          <select name="documentType" className={field} defaultValue="DNI">
            <option>DNI</option>
            <option>CE</option>
            <option>Pasaporte</option>
          </select>
        </label>
        <label className="block text-[13px] font-semibold">
          Número
          <input name="documentNumber" required className={field} />
        </label>
      </div>
      <label className="block text-[13px] font-semibold">
        Domicilio
        <input name="address" required className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-semibold">
          Teléfono
          <input name="phone" required className={field} />
        </label>
        <label className="block text-[13px] font-semibold">
          Correo
          <input name="email" type="email" required className={field} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-[13px] font-semibold">
        <input name="isMinor" type="checkbox" />
        El consumidor es menor de edad
      </label>
      <label className="block text-[13px] font-semibold">
        Padre, madre o tutor (si es menor)
        <input name="guardianName" className={field} />
      </label>
      <label className="block text-[13px] font-semibold">
        Bien o servicio
        <input
          name="product"
          required
          defaultValue="Recarga de saldo publicitario"
          className={field}
        />
      </label>
      <label className="block text-[13px] font-semibold">
        Monto reclamado (opcional)
        <input name="amountText" className={field} placeholder="USD 100" />
      </label>
      <label className="block text-[13px] font-semibold">
        Detalle
        <textarea name="detail" required minLength={15} className={`${field} h-28 py-2`} />
      </label>
      <label className="block text-[13px] font-semibold">
        Pedido del consumidor
        <textarea name="request" required minLength={8} className={`${field} h-24 py-2`} />
      </label>
      {error ? (
        <p className="rounded-lg bg-[#fef2f2] px-3 py-2 text-[13px] text-[#991b1b]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 items-center rounded-full bg-[#ff781f] px-5 text-[14px] font-bold text-white disabled:opacity-60"
      >
        {busy ? "Enviando…" : "Registrar reclamo"}
      </button>
    </form>
  );
}
