import assert from "node:assert/strict";
import test from "node:test";
import { contractDocumentHtml } from "./document-html.ts";

test("el html del contrato escapa el contenido", () => {
  const html = contractDocumentHtml({
    title: "Contrato",
    parties: "Holistic",
    body: "# Título\n\n<script>alert(1)</script>",
  });
  assert.equal(html.includes("<script>alert"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
  assert.equal(html.includes("<h1>Título</h1>"), true);
});
