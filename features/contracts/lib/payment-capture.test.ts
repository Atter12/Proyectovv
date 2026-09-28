import assert from "node:assert/strict";
import test from "node:test";
import { captureHasEditorMark, captureLooksLikeImage, decideMembershipCapture } from "./payment-capture.ts";

const clear = {
  image: true,
  bytes: 80_000,
  duplicate: false,
  editor: false,
  paid: true as boolean | null,
  looksLikeNas: true as boolean | null,
  edited: false as boolean | null,
  confidence: 0.93,
  duplicateReference: false,
};

test("un pago de NAS claro abre el acceso", () => {
  assert.equal(decideMembershipCapture(clear).decision, "approve");
});

test("volver con una imagen repetida no abre el panel", () => {
  assert.equal(decideMembershipCapture({ ...clear, duplicate: true }).decision, "reject");
});

test("una captura con marca de editor queda en revisión", () => {
  assert.equal(decideMembershipCapture({ ...clear, editor: true }).decision, "review");
});

test("una pantalla que no es un pago se rechaza", () => {
  const result = decideMembershipCapture({
    ...clear,
    paid: false,
    looksLikeNas: false,
    confidence: 0.9,
  });
  assert.equal(result.decision, "reject");
});

test("detecta jpg y una marca de editor en los metadatos", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0, 0x41, 0x64, 0x6f, 0x62, 0x65, 0x20, 0x50, 0x68, 0x6f, 0x74, 0x6f, 0x73, 0x68, 0x6f, 0x70]);
  assert.equal(captureLooksLikeImage(jpeg), true);
  assert.equal(captureHasEditorMark(jpeg), true);
});
