import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  buildContractPdf,
  documentTokenFromWebhook,
  parseRemoteEnvelope,
  splitSignerPhone,
  verifySignatureHmac,
} from "./signature.ts";

test("el celular peruano se separa del código de país", () => {
  assert.deepEqual(splitSignerPhone("999 888 777"), { countryCode: "+51", phone: "999888777" });
  assert.deepEqual(splitSignerPhone("+51 999888777"), { countryCode: "+51", phone: "999888777" });
  assert.equal(splitSignerPhone("123"), null);
});

test("el webhook solo entra con el HMAC del cuerpo", () => {
  const body = JSON.stringify({ token: "abcdef01-2345-6789-abcd-ef0123456789" });
  const secret = "secreto-de-prueba";
  const header = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  assert.equal(verifySignatureHmac(body, header, secret), true);
  assert.equal(verifySignatureHmac(body, `sha256=${header}`, secret), true);
  assert.equal(verifySignatureHmac(`${body} `, header, secret), false);
  assert.equal(verifySignatureHmac(body, header, "otro"), false);
});

test("el identificador sale del sobre y no del firmante", () => {
  const token = "abcdef01-2345-6789-abcd-ef0123456789";
  assert.equal(documentTokenFromWebhook({ document: { token }, signers: [{ token: "11111111-1111-4111-8111-111111111111" }] }), token);
  assert.equal(documentTokenFromWebhook({ event: "document_signed" }), null);
});

test("un sobre firmado trae el PDF y la fecha del firmante", () => {
  const envelope = parseRemoteEnvelope({
    token: "abcdef01-2345-6789-abcd-ef0123456789",
    status: "signed",
    signed_download_file: "https://app.firmeasy.legal/files/firmado.pdf",
    signers: [
      {
        token: "11111111-1111-4111-8111-111111111111",
        name: "Ana Ruiz",
        email: "ana@ejemplo.com",
        status: "signed",
        link: "https://app.firmeasy.legal/firma/ana",
        signed_at: "2026-09-26T15:00:00.000Z",
      },
    ],
  });
  assert.equal(envelope?.status, "signed");
  assert.equal(envelope?.signers[0]?.signedOn, "2026-09-26");
  assert.match(envelope?.signedDownloadUrl ?? "", /firmado\.pdf$/);
});

test("el borrador HTML sale como PDF de varias líneas", () => {
  const html = "<h1>Contrato de alianza</h1><p>Holistic y el aliado acuerdan la comisión.</p>";
  const pdf = buildContractPdf(html);
  const source = Buffer.from(pdf.bytes).toString("latin1");
  assert.equal(pdf.pages, 1);
  assert.match(source, /^%PDF-1\.4/);
  assert.match(source, /Contrato de alianza/);
  assert.match(source, /%%EOF/);
});
