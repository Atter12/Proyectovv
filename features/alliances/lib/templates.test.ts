import assert from "node:assert/strict";
import test from "node:test";
import {
  allianceTemplateValues,
  contractDocumentHtml,
  missingPlaceholders,
  overlayTemplateValues,
  parseTemplateDraft,
  placeholdersIn,
  renderTemplate,
} from "./templates.ts";

test("una plantilla rellena solo las variables y conserva el texto", () => {
  const body = "Acuerdo con {{alianza}} en {{ ciudad }}.";
  assert.deepEqual(placeholdersIn(body), ["alianza", "ciudad"]);
  assert.equal(renderTemplate(body, { alianza: "Mendoza Store", ciudad: "Lima" }), "Acuerdo con Mendoza Store en Lima.");
});

test("no genera si falta una variable usada", () => {
  const body = "{{alianza}} paga {{comision}}.";
  assert.deepEqual(missingPlaceholders(body, { alianza: "X", comision: "  " }), ["comision"]);
});

test("la ficha precarga la alianza y deja la ciudad en Lima", () => {
  const values = allianceTemplateValues({
    name: "Agencia Y",
    typeLabel: "Agencia",
    ownerName: "Ana",
    contactName: "Luis",
    email: "luis@y.com",
    phone: "",
    commissionTerms: "15%",
    startedOnLabel: "1 sept 2026",
    endsOnLabel: "",
    ourContribution: "Ads",
    theirContribution: "Marca",
    summary: "Publicidad en TikTok",
    todayLabel: "26 sept 2026",
  });
  assert.equal(values.alianza, "Agencia Y");
  assert.equal(values.tipo, "Agencia");
  assert.equal(values.ciudad, "Lima");
  assert.equal(values.inicio, "1 sept 2026");
  assert.equal(values.termino, "");
  assert.equal(values.hoy, "26 sept 2026");
});

test("el html escapa el contenido de la alianza", () => {
  const html = contractDocumentHtml({
    title: "NDA",
    parties: "Holistic",
    body: "# Título\n\n<script>alert(1)</script>",
  });
  assert.equal(html.includes("<script>alert"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
  assert.equal(html.includes("<h1>Título</h1>"), true);
});

test("una plantilla sin variables no se guarda", () => {
  const parsed = parseTemplateDraft({
    name: "Vacía",
    contractType: "nda",
    description: "",
    body: "Texto fijo sin datos de la alianza.",
    active: true,
  });
  assert.equal(parsed.ok, false);
});

test("el usuario puede corregir una variable precargada", () => {
  const values = overlayTemplateValues(
    { alianza: "Vieja", ciudad: "Lima" },
    { ciudad: "  Cusco " },
    ["ciudad"],
  );
  assert.equal(values.ciudad, "Cusco");
  assert.equal(values.alianza, "Vieja");
});
