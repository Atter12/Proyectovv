import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAllianceListRow,
  describeNextAction,
  dueHint,
  formatAllianceDate,
  isAllowedAllianceFile,
  parseAllianceDraft,
  parseContractDraft,
  presentContractStatus,
  safeStorageFileName,
  summarizeAllianceHome,
  emptyAllianceDraft,
} from "./domain.ts";

const today = "2026-09-26";

test("un contrato firmado dentro de 30 días se muestra por vencer", () => {
  assert.equal(presentContractStatus("signed", "2026-10-10", today), "expiring");
  assert.equal(presentContractStatus("signed", "2026-12-01", today), "signed");
  assert.equal(presentContractStatus("signed", "2026-09-01", today), "expired");
  assert.equal(presentContractStatus("pending_signature", "2026-09-01", today), "pending_signature");
  assert.equal(presentContractStatus("draft", "2026-09-01", today), "draft");
});

test("la lista prioriza firma pendiente y el recordatorio vencido", () => {
  const row = buildAllianceListRow({
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ecommerce X",
    allianceType: "ecommerce",
    status: "negotiating",
    ownerName: "Juan Pérez",
    contactName: "Ana",
    email: "ana@ejemplo.com",
    nextAction: "Revisión mensual",
    today,
    contracts: [
      { status: "signed", expiresOn: "2026-12-01" },
      { status: "pending_signature", expiresOn: "2026-10-01" },
    ],
    reminders: [{ title: "Firmar contrato", dueOn: "2026-09-20", status: "open" }],
  });

  assert.equal(row.contractStatus, "pending_signature");
  assert.equal(row.nextAction, "Firmar contrato");
  assert.equal(row.nextActionOverdue, true);
  assert.equal(row.needsAttention, true);
});

test("sin recordatorios abiertos usa la acción anotada", () => {
  const action = describeNextAction(
    "Renovación",
    [{ title: "Llamada", dueOn: "2026-09-01", status: "done" }],
    today,
  );
  assert.equal(action.text, "Renovación");
  assert.equal(action.overdue, false);
});

test("el resumen del home cuenta firmas y atención", () => {
  const row = buildAllianceListRow({
    id: "22222222-2222-4222-8222-222222222222",
    name: "Agencia Y",
    allianceType: "agency",
    status: "active",
    ownerName: "Carlos",
    contactName: "",
    email: "",
    nextAction: "",
    today,
    contracts: [{ status: "signed", expiresOn: "2026-10-01" }],
    reminders: [],
  });
  const stats = summarizeAllianceHome(
    [row],
    [{ status: "pending_signature", expiresOn: null }],
    today,
  );
  assert.equal(stats.active, 1);
  assert.equal(stats.pendingSignature, 1);
  assert.equal(stats.needsAttention, 1);
  assert.equal(row.contractStatus, "expiring");
});

test("la fecha de término no puede quedar antes del inicio", () => {
  const parsed = parseAllianceDraft({
    ...emptyAllianceDraft(),
    name: "Partner Z",
    ownerName: "Ana",
    startedOn: "2026-10-01",
    endsOn: "2026-09-01",
  });
  assert.equal(parsed.ok, false);
});

test("un firmante vacío se ignora y uno incompleto se rechaza", () => {
  const empty = parseContractDraft({
    contractType: "nda",
    version: 2,
    status: "draft",
    sentOn: "",
    expiresOn: "2027-01-01",
    notes: "",
    signers: [{ name: "  ", email: "", phone: "", roleTitle: "", signedOn: "" }],
  });
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(empty.value.signers.length, 0);

  const invalid = parseContractDraft({
    contractType: "nda",
    version: 1,
    status: "draft",
    sentOn: "",
    expiresOn: "",
    notes: "",
    signers: [{ name: "A", email: "", phone: "", roleTitle: "Legal", signedOn: "" }],
  });
  assert.equal(invalid.ok, false);
});

test("el nombre de archivo no conserva rutas", () => {
  assert.equal(safeStorageFileName("..\\..\\Contrato Final.PDF"), "contrato-final.pdf");
  const allowed = isAllowedAllianceFile("propuesta.pdf", 1200);
  assert.equal(allowed.ok, true);
  assert.equal(isAllowedAllianceFile("virus.exe", 1200).ok, false);
  assert.equal(isAllowedAllianceFile("grande.pdf", 11 * 1024 * 1024).ok, false);
});

test("las fechas de calendario no se corren de día", () => {
  assert.match(formatAllianceDate("2026-09-26"), /^26\b/);
  assert.equal(dueHint("2026-09-26", today), "Hoy");
  assert.equal(dueHint("2026-09-25", today), "Ayer");
  assert.equal(dueHint("2026-09-28", today), "En 2 días");
});
