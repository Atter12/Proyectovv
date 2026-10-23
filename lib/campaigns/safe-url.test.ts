import assert from "node:assert/strict";
import test from "node:test";
import { checkPublicUrl, isPrivateAddress } from "./safe-url.ts";

test("acepta links normales de tiendas (y completa https://)", () => {
  const a = checkPublicUrl("https://mitienda.pe/products/samba#reseñas");
  assert.ok(a.ok);
  assert.equal(a.url.toString(), "https://mitienda.pe/products/samba");
  const b = checkPublicUrl("tienda.myshopify.com/products/x");
  assert.ok(b.ok);
  assert.equal(b.url.protocol, "https:");
});

test("rechaza localhost, redes internas, puertos y protocolos raros", () => {
  for (const [raw, reason] of [
    ["http://localhost:3000/x", "port"],
    ["http://localhost/x", "host"],
    ["http://127.0.0.1/", "host"],
    ["http://169.254.169.254/latest/meta-data/", "host"],
    ["http://10.0.0.5/", "host"],
    ["http://192.168.1.1/", "host"],
    ["http://[::1]/", "host"],
    ["http://[::ffff:127.0.0.1]/", "host"],
    ["http://servidor/", "host"],
    ["http://db.internal/", "host"],
    ["ftp://tienda.pe/x", "protocol"],
    ["file:///etc/passwd", "protocol"],
    ["https://user:pass@tienda.pe/", "invalid"],
    ["https://tienda.pe:8443/", "port"],
    ["no es un link", "invalid"],
  ] as const) {
    const r = checkPublicUrl(raw);
    assert.equal(r.ok, false, raw);
    if (!r.ok) assert.equal(r.reason, reason, raw);
  }
});

test("IPs privadas y públicas", () => {
  for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fc00::1", "fd12::3", "fe80::1", "::ffff:10.0.0.1", "::ffff:a9fe:a9fe"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "104.18.2.3", "2606:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});
