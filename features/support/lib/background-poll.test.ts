import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPPORT_BACKGROUND_POLL_MS,
  planBackgroundStaffNotice,
  shouldPollSupportBackground,
} from "./background-poll.ts";

test("el aviso de fondo cabe entre 20 y 30 segundos", () => {
  assert.ok(SUPPORT_BACKGROUND_POLL_MS >= 20_000);
  assert.ok(SUPPORT_BACKGROUND_POLL_MS <= 30_000);
});

test("no pide mensajes con la pestaña oculta ni con una lectura en curso", () => {
  assert.equal(
    shouldPollSupportBackground({
      cancelled: false,
      inFlight: false,
      visibilityState: "hidden",
    }),
    false,
  );
  assert.equal(
    shouldPollSupportBackground({
      cancelled: false,
      inFlight: true,
      visibilityState: "visible",
    }),
    false,
  );
  assert.equal(
    shouldPollSupportBackground({
      cancelled: true,
      inFlight: false,
      visibilityState: "visible",
    }),
    false,
  );
  assert.equal(
    shouldPollSupportBackground({
      cancelled: false,
      inFlight: false,
      visibilityState: "visible",
    }),
    true,
  );
});

test("la primera lectura anota el mensaje y no avisa", () => {
  const notice = planBackgroundStaffNotice({
    messages: [
      { id: "support-greeting", role: "bot", text: "Hola" },
      { id: "m1", role: "bot", text: "Ya revisé tu recarga" },
    ],
    seeded: false,
    lastSeenStaffMessageId: null,
    fallbackPreview: "Nuevo mensaje",
  });
  assert.deepEqual(notice, { action: "seed", messageId: "m1" });
});

test("un mensaje nuevo del gerente avisa y recorta la vista previa", () => {
  const notice = planBackgroundStaffNotice({
    messages: [
      { id: "m1", role: "bot", text: "anterior" },
      { id: "m2", role: "bot", text: "x".repeat(120) },
    ],
    seeded: true,
    lastSeenStaffMessageId: "m1",
    fallbackPreview: "Nuevo mensaje",
  });
  assert.equal(notice.action, "notify");
  if (notice.action !== "notify") return;
  assert.equal(notice.messageId, "m2");
  assert.equal(notice.preview.length, 80);
});

test("el mismo mensaje no vuelve a sonar", () => {
  const notice = planBackgroundStaffNotice({
    messages: [{ id: "m2", role: "bot", text: "listo" }],
    seeded: true,
    lastSeenStaffMessageId: "m2",
    fallbackPreview: "Nuevo mensaje",
  });
  assert.deepEqual(notice, { action: "ignore" });
});

test("el saludo automático no cuenta como respuesta", () => {
  const notice = planBackgroundStaffNotice({
    messages: [{ id: "support-greeting", role: "bot", text: "Hola" }],
    seeded: true,
    lastSeenStaffMessageId: null,
    fallbackPreview: "Nuevo mensaje",
  });
  assert.deepEqual(notice, { action: "ignore" });
});

test("sin texto usa el aviso genérico", () => {
  const notice = planBackgroundStaffNotice({
    messages: [{ id: "m3", role: "bot", text: "" }],
    seeded: true,
    lastSeenStaffMessageId: "m2",
    fallbackPreview: "Te respondieron",
  });
  assert.deepEqual(notice, {
    action: "notify",
    messageId: "m3",
    preview: "Te respondieron",
  });
});
