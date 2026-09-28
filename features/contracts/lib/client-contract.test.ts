import assert from "node:assert/strict";
import test from "node:test";
import { clientContractBlocks, parseClientContract } from "./client-contract.ts";

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
  const text = clientContractBlocks(parsed.value);
  assert.match(text, /10%/);
  assert.match(text, /no tiene precio de entrada/);
  assert.equal(text.includes("SEXTO"), false);
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
