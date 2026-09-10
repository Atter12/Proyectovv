# Profit — análisis de campañas en Ads Holistic

## Qué es

`/profit` (nav: debajo de **Pago**):

**Gratis (Holistic)**  
Gasto TikTok, live, ranking, CTR/CPC/CPM, pacing, señales, fee / BE ROAS.

**Extra · Real Profit COD · +$20 / mes**  
Pedidos cobrados, ROAS/CPA COD, conexión de tienda Shopify vía app Real Profit.

`/gastos` redirige a `/profit`.

Ver también:

- [`SALES_SOURCES_REALPROFIT.md`](./SALES_SOURCES_REALPROFIT.md)
- Cobro voucher: [`PLAN_REALPROFIT_COBRO_MANUAL.md`](./PLAN_REALPROFIT_COBRO_MANUAL.md)
- Triggers Shopify/Meta: [`PLAN_REALPROFIT_SHOPIFY_META.md`](./PLAN_REALPROFIT_SHOPIFY_META.md)

## Cobro del extra (+$20)

**No WhatsApp.** Misma cuenta de pago manual Holistic (BCP / CCI):

1. Cliente elige “Pagar $20 / mes” en el modal de Profit  
2. Deposita USD 20 → sube voucher  
3. Staff revisa en admin pagos  
4. Si OK → se habilita Real Profit COD (sin acreditar cartera TikTok)  
5. Entonces puede **Instalar app Shopify** → pedidos se jalan solos  

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
