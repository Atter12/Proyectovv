# Real Profit COD — vista promo en Ads Holistic

## Qué es

Panel ligero en Ads Holistic (`/profit`) que muestra:

- **Cobrado** (órdenes `rp_orders.status_cod = collected`)
- **Gasto ads** — prioridad `rp_ad_spend_daily`; si está vacío → **TikTok Holistic** (`tiktok_spend_snapshots` + `gastos`)
- **ROAS cobrado** = cobrado ÷ gasto (nivel **tienda**; híbrido OK)
- **Campañas**: gasto real + cobrado/ROAS **estimado** (reparto proporcional al gasto)

El producto completo de Real Profit COD se ofrece aparte (upsell).

## Híbrido 1 + 2 + 3

| # | Pieza | Fuente |
|---|--------|--------|
| 1 | Gasto TikTok | Holistic (cliente Hecom seleccionado) |
| 2 | ROAS | Cobrado RP ÷ gasto (RP o Holistic fallback) |
| 3 | Tabla campañas | Misma fuente de gasto + cobrado estimado por % |

Sin tienda vinculada igual se muestra el bloque **Cuentas TikTok (Holistic)** (cobrado = 0, CTA a vincular).

Badge en UI: `Gasto · Real Profit` vs `Gasto · TikTok Holistic`.

## Misma base

Proyectovv y Real Profit usan el mismo Supabase (`DATABASE_URL` / proyecto `jxiifmlbmqmokgmillup`). Holistic lee tablas `rp_*` con service role y tablas Hecom (`gastos`, `tiktok_spend_snapshots`) con el client Hecom.

## Mapeo cliente ↔ tienda

Tabla `hecom_cliente_rp_stores`:

| Columna | Uso |
|---------|-----|
| `hecom_cliente_id` | Cliente Hecom seleccionado |
| `rp_store_id` | FK a `rp_stores` |

Staff vincula desde la UI la tienda RP **del mismo cliente** (no tiendas ajenas ni de lab).

## APIs

- `GET /api/profit?from=&to=` — snapshots + `holisticSpend`
- `GET /api/profit/stores` — lista `rp_stores` (staff)
- `POST /api/profit/link` — `{ storeId, action: "link"|"unlink" }` (staff)

## Fórmulas

```
roasCollected = collectedRevenue / adSpend   // null si spend = 0
collectedEstimated_campaign = collectedRevenue * (spend_campaign / adSpend)
roasEstimated_campaign = collectedEstimated / spend_campaign
```

## Env

```
NEXT_PUBLIC_REALPROFIT_URL=https://www.realprofitcod.com
# Misma DATABASE_URL que Real Profit (tablas rp_*)
# Credenciales Hecom para gastos / snapshots TikTok
```

## Límites

- Sin atribución pedido→campaña todavía (estimado).
- Si RP no sync spend, Holistic alimenta gasto/campañas (moneda: tienda RP o USD en preview Holistic).
- No usa cobros/wallet Hecom como “cobrado COD”.
