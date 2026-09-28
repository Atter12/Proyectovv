import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseClientContract } from "./client-contract.ts";

const base = {
  partyType: "natural" as const,
  legalName: "Abel Mogollon",
  docType: "dni" as const,
  docNumber: "70901048",
  address: "Av. Ejemplo 123, Lima",
  phone: "937757961",
  email: "abel@correo.com",
};

test("persona natural queda con DNI, fee 10 y sin entrada", () => {
  const parsed = parseClientContract(base);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.feePercent, 10);
  assert.equal(parsed.value.entryAmount, null);
  assert.equal(parsed.value.docNumber, "70901048");
  const template = readFileSync(new URL("./service-contract.template.txt", import.meta.url), "utf8");
  assert.match(template, /10 %/);
  assert.equal(/precio de entrada/i.test(template), false);
});

test("una empresa exige RUC de 11 dígitos", () => {
  const invalid = parseClientContract({
    ...base,
    partyType: "company",
    docType: "dni",
    docNumber: "70901048",
  });
  assert.equal(invalid.ok, false);

  const valid = parseClientContract({
    ...base,
    partyType: "company",
    legalName: "Tienda SAC",
    docType: "ruc",
    docNumber: "20616314557",
  });
  assert.equal(valid.ok, true);
});
