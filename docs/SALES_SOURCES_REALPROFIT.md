# Ventas reales → Profit / Real Profit COD

## Modelo de producto

| Capa | Qué incluye | Precio |
|------|-------------|--------|
| **Holistic Profit (gratis)** | Gasto TikTok, live, CTR/CPC, pacing, señales, fee/BE ROAS | Incluido en Holistic |
| **Real Profit COD (extra)** | Pedidos + cobrado COD + ROAS/CPA cobrado + ops COD | **+$20** / cliente |

La conexión de **tienda** (Shopify u otra) vive en **Real Profit COD**, no en el panel gratis de Holistic.

## ¿Shopify es lo más cómodo?

**Sí, para la mayoría de clientes COD en LatAm que ya venden por landing/Shopify:**

- API madura (Orders, webhooks `orders/paid`, fulfilled, refunds)
- COD se modela bien (tags / gateway / fulfillment)
- Real Profit ya está armado alrededor de tiendas Shopify (`rp_stores`, `rp_orders`)

No es la única fuente — es el **camino más rápido al cobrado real**.

## De dónde más jalar ventas

| Fuente | Qué da | Dificultad | Notas |
|--------|--------|------------|--------|
| **Shopify** | Órdenes, paid/collected, COD | Baja | Preferida v1 Real Profit |
| **TikTok Shop** | Órdenes Shop + `is_cod` / COD fees | Media | API Commerce distinta a Ads; país/disponibilidad |
| **WooCommerce** | Órdenes REST + webhooks | Baja–media | Muy usado en LatAm |
| **Mercado Libre** | Órdenes marketplace | Media | No es COD landing clásico |
| **Pixel / Events API** | Purchase events (no = cobrado) | Ya casi | Bueno para funnels; **no** reemplaza plata en mano |
| **Ads conversions** | Conv. atribuidas TikTok | Ya en Profit perf | Plataforma ≠ cobrado COD |
| **CSV / manual** | Import orders | Baja | Bridge mientras no hay OAuth |
| **WhatsApp / sheets** | Ops artesanal | Alta fricción | Evitar como fuente primaria |

### TikTok Ads vs TikTok Shop

- **Ads report** (lo gratis en Profit): spend, impresiones, CTR, CPC, *conversions de pixel* — no es “pedido cobrado”.
- **TikTok Shop orders**: ventas reales del catálogo Shop; útil si el cliente vende ahí, no si solo hace spark ads → landing Shopify.

## Orden recomendado (Real Profit)

1. **Shopify** (core) — conectar cualquier tienda, jalar pedidos/cobrado  
2. **WooCommerce** — segundo conector si hay demanda  
3. **TikTok Shop** — cuando el cliente vende in-app  
4. **Pixel Purchase** — complemento de atribución, no ledger de cobrado  

## Cómo se ve en Holistic

- `/profit` gratis = performance ads  
- CTA **Real Profit COD · +$20** = pedidos + cobrado  
- Nav: Profit debajo de Pago  

Sin vincular tienda desde Holistic staff picker (eso era confuso / lab).
