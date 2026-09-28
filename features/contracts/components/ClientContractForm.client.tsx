"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import { AuthFormHeading, AuthNotice, AuthSubmitButton } from "@/features/auth/components/AuthFormUi";
import styles from "@/features/auth/components/auth.module.css";
import { submitClientServiceContractAction } from "../actions";

export function ClientContractForm({
  legalName,
  docNumber,
  phone,
  email,
}: {
  legalName: string;
  docNumber: string;
  phone: string;
  email: string;
}) {
  const router = useRouter();
  const initialParty = docNumber.replace(/\D/g, "").length === 11 ? "company" : "natural";
  const [partyType, setPartyType] = useState<"natural" | "company">(initialParty);
  const [name, setName] = useState(legalName);
  const [documentNumber, setDocumentNumber] = useState(docNumber.replace(/\D/g, ""));
  const [address, setAddress] = useState("");
  const [mobile, setMobile] = useState(phone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docType = partyType === "company" ? "ruc" : "dni";
  const docLimit = docType === "ruc" ? 11 : 8;

  function chooseParty(next: "natural" | "company") {
    setPartyType(next);
    setDocumentNumber("");
    setError(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await submitClientServiceContractAction({
      partyType,
      legalName: name,
      docType,
      docNumber: documentNumber,
      address,
      phone: mobile,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(routes.membershipCheckout);
    router.refresh();
  }

  return (
    <div className="w-full">
      <AuthFormHeading title="Tu contrato">
        Confirma tus datos para firmar. El fee es 10% y no hay precio de entrada. FirmEasy te avisa por WhatsApp y por correo.
      </AuthFormHeading>
      <form onSubmit={onSubmit} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label htmlFor="party-type" className={styles.fieldLabel}>Tipo</label>
          <select
            id="party-type"
            value={partyType}
            onChange={(event) => chooseParty(event.target.value === "company" ? "company" : "natural")}
            className="auth-field"
          >
            <option value="natural">Persona natural</option>
            <option value="company">Empresa</option>
          </select>
        </div>
        <div className={styles.fieldGroup}>
          <label htmlFor="legal-name" className={styles.fieldLabel}>Nombre legal</label>
          <input id="legal-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required className="auth-field" />
        </div>
        <div className={styles.twoColumns}>
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Documento</span>
            <p className="auth-field flex items-center">{docType === "ruc" ? "RUC" : "DNI"}</p>
          </div>
          <div className={styles.fieldGroup}>
            <label htmlFor="doc-number" className={styles.fieldLabel}>N° identificador</label>
            <input
              id="doc-number"
              inputMode="numeric"
              value={documentNumber}
              maxLength={docLimit}
              required
              onChange={(event) => setDocumentNumber(event.target.value.replace(/\D/g, "").slice(0, docLimit))}
              placeholder={docType === "ruc" ? "11 dígitos" : "8 dígitos"}
              className="auth-field"
            />
          </div>
        </div>
        <div className={styles.fieldGroup}>
          <label htmlFor="address" className={styles.fieldLabel}>Domicilio</label>
          <input id="address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={240} required className="auth-field" placeholder="Calle, número, distrito y ciudad" />
        </div>
        <div className={styles.fieldGroup}>
          <label htmlFor="contract-phone" className={styles.fieldLabel}>Celular</label>
          <input id="contract-phone" type="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} required className="auth-field" />
          <p className="text-xs text-[var(--auth-text-muted)]">FirmEasy envía el enlace de firma a este número por WhatsApp.</p>
        </div>
        <div className={styles.fieldGroup}>
          <label htmlFor="contract-email" className={styles.fieldLabel}>Correo</label>
          <input id="contract-email" value={email} readOnly className="auth-field" />
        </div>
        <AuthNotice tone="info">Comisión variable: 10%. Sin precio de entrada.</AuthNotice>
        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
        <AuthSubmitButton loading={pending} loadingLabel="Enviando a firma…">Enviar a firma</AuthSubmitButton>
      </form>
    </div>
  );
}
