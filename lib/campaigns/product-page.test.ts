import assert from "node:assert/strict";
import test from "node:test";
import {
  absoluteImage,
  hasEnoughProductInfo,
  htmlToText,
  mergeProductInfo,
  parsePrice,
  parseProductPage,
  parseShopifyProduct,
  shopifyJsonUrl,
} from "./product-page.ts";

test("entiende precios de Perú, Colombia y USD", () => {
  assert.equal(parsePrice("S/ 129.90"), 129.9);
  assert.equal(parsePrice("S/ 1,299.90"), 1299.9);
  assert.equal(parsePrice("$129.900"), 129900);
  assert.equal(parsePrice("$ 1.299.000"), 1299000);
  assert.equal(parsePrice("129,90"), 129.9);
  assert.equal(parsePrice("1.299,90"), 1299.9);
  assert.equal(parsePrice("1,299"), 1299);
  assert.equal(parsePrice(89), 89);
  assert.equal(parsePrice("gratis"), null);
  assert.equal(parsePrice(0), null);
});

const WOO = `<!doctype html><html><head>
<title>Zapatillas Samba OG | Mi Tienda</title>
<meta property="og:site_name" content="Mi Tienda">
<meta property="og:title" content="Zapatillas Samba OG | Mi Tienda">
<meta property="og:description" content="Las zapatillas cl&aacute;sicas que todos buscan. Env&iacute;o gratis a todo el Per&uacute;.">
<meta property="og:image" content="/wp-content/uploads/samba-1.jpg">
<meta property="og:image" content="https://cdn.mitienda.pe/logo.svg">
<meta property="product:price:amount" content="189.90">
<meta property="product:price:currency" content="pen">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
  {"@type":"WebSite","name":"Mi Tienda"},
  {"@type":"Product","name":"Zapatillas Samba OG","description":"Cuero premium. Suela de goma.",
   "image":["https://cdn.mitienda.pe/samba-2.jpg",{"url":"https://cdn.mitienda.pe/samba-3.jpg"}],
   "brand":{"@type":"Brand","name":"Adidas"},
   "offers":[{"@type":"Offer","price":"189.90","priceCurrency":"PEN"},{"@type":"Offer","price":"179.90","priceCurrency":"PEN"}]}
]}</script>
<script type="application/ld+json">{ roto </script>
</head><body>
<div class="product-description"><ul><li>Cuero premium</li><li>Suela de goma antideslizante</li><li>x</li></ul></div>
</body></html>`;

test("lee JSON-LD, Open Graph y la lista de beneficios", () => {
  const info = parseProductPage(WOO, "https://mitienda.pe/producto/samba");
  assert.equal(info.title, "Zapatillas Samba OG");
  assert.equal(info.price, 179.9);
  assert.equal(info.currency, "PEN");
  assert.equal(info.brand, "Adidas");
  assert.equal(info.siteName, "Mi Tienda");
  assert.equal(info.description, "Cuero premium. Suela de goma.");
  assert.deepEqual(info.images, [
    "https://cdn.mitienda.pe/samba-2.jpg",
    "https://cdn.mitienda.pe/samba-3.jpg",
    "https://mitienda.pe/wp-content/uploads/samba-1.jpg",
  ]);
  assert.deepEqual(info.bullets, ["Cuero premium", "Suela de goma antideslizante"]);
  assert.ok(hasEnoughProductInfo(info));
});

test("sin JSON-LD usa meta tags y el <title>", () => {
  const html = `<html><head><title>Faja Reductora Pro</title>
    <meta name="description" content="Moldea tu figura desde el primer d&#237;a.">
    <meta name="twitter:image" content="https://landing.pe/img/faja.webp"></head></html>`;
  const info = parseProductPage(html, "https://landing.pe/faja");
  assert.equal(info.title, "Faja Reductora Pro");
  assert.equal(info.description, "Moldea tu figura desde el primer día.");
  assert.equal(info.price, null);
  assert.deepEqual(info.images, ["https://landing.pe/img/faja.webp"]);
});

test("Shopify: arma el link del JSON y lee precios en centavos", () => {
  assert.equal(shopifyJsonUrl("https://tienda.pe/products/samba-og?variant=1"), "https://tienda.pe/products/samba-og.js");
  assert.equal(shopifyJsonUrl("https://tienda.pe/collections/all/products/samba-og/"), "https://tienda.pe/collections/all/products/samba-og.js");
  assert.equal(shopifyJsonUrl("https://tienda.pe/pages/contacto"), null);

  const shop = parseShopifyProduct(
    {
      title: "Samba OG",
      vendor: "Adidas",
      price: 18990,
      compare_at_price: 24990,
      description: "<p>Clásicas.</p><ul><li>Cuero premium</li><li>Talla 36 a 43</li></ul>",
      images: ["//cdn.shopify.com/s/files/samba.jpg"],
    },
    "https://tienda.pe/products/samba-og",
  );
  assert.ok(shop);
  assert.equal(shop.price, 189.9);
  assert.equal(shop.oldPrice, 249.9);
  assert.deepEqual(shop.bullets, ["Cuero premium", "Talla 36 a 43"]);

  const page = parseProductPage(WOO, "https://tienda.pe/products/samba-og");
  const merged = mergeProductInfo(shop, page);
  assert.equal(merged.title, "Samba OG");
  assert.equal(merged.price, 189.9);
  assert.equal(merged.oldPrice, 249.9);
  assert.equal(merged.currency, "PEN");
  assert.equal(merged.images[0], "https://cdn.shopify.com/s/files/samba.jpg");
  assert.equal(parseShopifyProduct({ nope: 1 }, "https://x.pe"), null);
});

test("descarta íconos, logos y data URIs", () => {
  assert.equal(absoluteImage("data:image/png;base64,xx", "https://a.pe"), null);
  assert.equal(absoluteImage("/img/logo-tienda.png", "https://a.pe"), null);
  assert.equal(absoluteImage("/favicon.ico", "https://a.pe"), null);
  assert.equal(absoluteImage("javascript:alert(1)", "https://a.pe"), null);
  assert.equal(absoluteImage("../fotos/1.jpg", "https://a.pe/p/x"), "https://a.pe/fotos/1.jpg");
});

test("htmlToText quita scripts y respeta saltos", () => {
  assert.equal(htmlToText("<p>Hola&nbsp;mundo</p><script>x()</script><p>Chau</p>"), "Hola mundo\nChau");
});

test("la misma foto de la CDN y de la tienda cuenta una sola vez (prefiere https)", () => {
  const html = `<meta property="og:image" content="http://tienda.pe/cdn/shop/files/A.png?v=1">
    <meta property="og:image" content="https://cdn.shopify.com/s/files/1/A.png?v=1">
    <meta property="og:image" content="https://cdn.shopify.com/s/files/1/B.png"><title>Polo básico</title>`;
  const info = parseProductPage(html, "https://tienda.pe/products/polo");
  assert.deepEqual(info.images, ["https://cdn.shopify.com/s/files/1/A.png?v=1", "https://cdn.shopify.com/s/files/1/B.png"]);
});
