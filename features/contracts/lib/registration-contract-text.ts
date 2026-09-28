import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ClientContractValue } from "./client-contract";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Texto del contrato que soporte firma en reunión, sin cláusula de precio de entrada. */
export function registrationServiceContractText(value: ClientContractValue): string {
  const template = readFileSync(
    path.join(process.cwd(), "features/contracts/lib/service-contract.template.txt"),
    "utf8",
  );
  const company = value.partyType === "company";
  const doc = company ? "RUC" : "DNI";
  const party = company
    ? `la empresa ${value.legalName}, identificada con ${doc} N.° ${value.docNumber}`
    : `la persona natural ${value.legalName}, identificado con ${doc} N.° ${value.docNumber}`;
  const start = new Date();
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return template
    .replaceAll("«PARTE»", party)
    .replaceAll("«DOMICILIO»", value.address)
    .replaceAll("«TRATO»", company ? "denominada" : "denominado")
    .replaceAll("«INICIO»", contractDate(start))
    .replaceAll("«FIN»", contractDate(end))
    .replaceAll("«FIRMA»", contractDate(start))
    .replaceAll("«FIRMANTE»", `${value.legalName}\n${doc} N.° ${value.docNumber}`);
}

function contractDate(date: Date): string {
  const lima = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  return `${lima.getUTCDate()} de ${MONTHS[lima.getUTCMonth()]} del ${lima.getUTCFullYear()}`;
}
