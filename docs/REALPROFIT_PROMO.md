# Profit — análisis de campañas en Ads Holistic

## Qué es

`/profit` (nav: debajo de **Pago**):

**Gratis (Holistic)**  
Gasto TikTok, live, ranking, CTR/CPC/CPM, pacing, señales, fee / BE ROAS.

**Extra · Real Profit COD · +$20**  
Pedidos cobrados, ROAS/CPA COD, conexión de tienda (Shopify u otras vía RP).  
La tienda **no** se vincula desde el panel gratis.

`/gastos` redirige a `/profit`.

Ver también: [`SALES_SOURCES_REALPROFIT.md`](./SALES_SOURCES_REALPROFIT.md).

## Fuentes (gratis)

| Dato | Fuente |
|------|--------|
| Gasto / serie | `tiktok_spend_snapshots` + `gastos` |
| Perf campaña | TikTok report AUCTION_CAMPAIGN (cache 5 min) |
| Fee | `tiktok_default_fee` |

## Cobrado (extra RP)

| Dato | Fuente |
|------|--------|
| Órdenes / cobrado | Real Profit (`rp_orders`) vía producto COD |

## Env

```
NEXT_PUBLIC_REALPROFIT_URL=https://www.realprofitcod.com
```
