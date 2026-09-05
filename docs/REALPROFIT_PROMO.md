# Profit — análisis de campañas en Ads Holistic

## Qué es

Centro de análisis en `/profit` (reemplaza Gastos en el nav; `/gastos` redirige acá):

1. **Consumo TikTok**: hoy / 7d / 30d / rango + serie diaria  
2. **Comparar + pacing**: vs ayer, vs 7d previos, vs período anterior  
3. **Live**: saldo + spend hoy por cuenta  
4. **Ranking + performance TikTok**: Imp / CTR / CPC / CPM / conv. (cache 5 min)  
5. **Señales**: concentración, pacing, ROAS débil, CTR bajo  
6. **Unit economics**: fee Holistic, coste efectivo, BE ROAS (ads+fee), CPA/ROAS cobrado si hay COD  

## Fuentes

| Dato | Fuente |
|------|--------|
| Gasto / campañas / serie | Holistic: `tiktok_spend_snapshots` + `gastos` |
| Perf campaña | TikTok `report/integrated` AUCTION_CAMPAIGN |
| Cobrado | `rp_orders` collected vía tienda vinculada |
| Fee | `tiktok_default_fee` / fee de cuenta |

## Fórmulas útiles

```
effectiveAdSpend = spendInRange * (1 + feePercent/100)
breakEvenRoas    = 1 + feePercent/100   // solo ads+fee, sin COGS producto
roasEffective    = collected / effectiveAdSpend
cpaCollected     = spendInRange / ordersCollected
```

## APIs

- `GET /api/profit?from=&to=` → `{ analysis, linkedStores, snapshots }`  
- `GET /api/profit/stores` / `POST /api/profit/link` (staff)

## Env

```
NEXT_PUBLIC_REALPROFIT_URL=https://www.realprofitcod.com
```
