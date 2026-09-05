# Profit — análisis de campañas en Ads Holistic

## Qué es

Centro de análisis en `/profit`:

1. **Consumo TikTok** (lo que antes vivía solo en Gastos): hoy / 7d / 30d / rango + serie diaria  
2. **Comparar + pacing**: vs ayer, vs 7d previos, vs período anterior; pacing hoy ÷ promedio 7d  
3. **Live**: saldo + spend hoy por cuenta (poll ~45s, mismo endpoint que Cuentas ads)  
4. **Ranking + performance TikTok**: impresiones, clicks, CTR, CPC, CPM, conversiones (report live)  
5. **Señales**: concentración, pacing, ROAS débil, CTR bajo  
6. **Cobrado COD** (opcional): tienda Real Profit vinculada → ROAS cobrado + estimado por campaña  

Gastos (`/gastos`) sigue como ledger simple; Profit es la superficie para **decidir**.

## Fuentes

| Dato | Fuente |
|------|--------|
| Gasto / campañas / serie | Holistic: `tiktok_spend_snapshots` + `gastos` |
| Cobrado | `rp_orders` (status `collected`) vía tienda vinculada |
| Gasto fallback tienda RP | `rp_ad_spend_daily`; si vacío → Holistic |

## Híbrido

- Sin tienda RP: análisis Holistic completo (sin ROAS cobrado).  
- Con tienda: cobrado real + ROAS = cobrado ÷ gasto Holistic (o RP si sync).  
- Cobrado por campaña = estimado por % de gasto (sin atribución pedido→campaña aún).

## Mapeo cliente ↔ tienda (opcional)

Tabla `hecom_cliente_rp_stores` — solo la tienda COD **de ese** cliente.

## APIs

- `GET /api/profit?from=&to=` → `{ analysis, linkedStores, snapshots }`  
- `GET /api/profit/stores` / `POST /api/profit/link` (staff)

## Env

```
NEXT_PUBLIC_REALPROFIT_URL=https://www.realprofitcod.com
```

Misma `DATABASE_URL` que Real Profit + credenciales Hecom.
