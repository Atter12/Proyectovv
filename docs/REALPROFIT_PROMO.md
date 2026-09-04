# Real Profit COD — vista promo en Ads Holistic

## Qué es

Panel ligero en Ads Holistic (`/profit`) que muestra:

- **Cobrado** (órdenes `rp_orders.status_cod = collected`)
- **Gasto ads** (`rp_ad_spend_daily`)
- **ROAS cobrado** = cobrado ÷ gasto (nivel **tienda**)
- **Campañas**: gasto real + cobrado/ROAS **estimado** (reparto proporcional al gasto)

El producto completo de Real Profit COD se ofrece aparte (upsell). Sync Meta/TikTok de ads sigue en Real Profit.

## Misma base

Proyectovv y Real Profit usan el mismo Supabase (`DATABASE_URL` / proyecto `jxiifmlbmqmokgmillup`). Holistic lee tablas `rp_*` con service role.

## Mapeo cliente ↔ tienda

Tabla `hecom_cliente_rp_stores`:

| Columna | Uso |
|---------|-----|
| `hecom_cliente_id` | Cliente Hecom seleccionado |
| `rp_store_id` | FK a `rp_stores` |

Staff vincula desde la UI (picker de tiendas RP, **incluye inactivas** de prueba).

## APIs

- `GET /api/profit?from=&to=` — snapshots del cliente seleccionado
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
```

## Límites

- Sin atribución pedido→campaña todavía (estimado).
- Si no hay filas en `rp_ad_spend_daily`, ROAS = — y tabla de campañas vacía.
- Requiere cliente Hecom seleccionado + tienda vinculada.
