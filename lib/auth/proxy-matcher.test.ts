import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

// Si una página del panel no pasa por el proxy, el token renovado en el
// servidor no se guarda y Supabase termina cerrando la sesión del usuario.
const root = new URL("../../", import.meta.url);
const proxySource = readFileSync(new URL("proxy.ts", root), "utf8");
const matcher = new Set(
  [...proxySource.slice(proxySource.indexOf("matcher:")).matchAll(/"([^"]+)"/g)].map((match) => match[1]),
);

test("cada página del panel pasa por el proxy", () => {
  const sections = readdirSync(new URL("app/(dashboard)/", root), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `/${entry.name}`);
  const missing = sections.filter((route) => !matcher.has(route) || !matcher.has(`${route}/:path*`));
  assert.deepEqual(missing, [], `Faltan en el matcher de proxy.ts: ${missing.join(", ")}`);
});

test("la portada pasa por el proxy porque lee la sesión", () => {
  assert.ok(matcher.has("/"));
});
