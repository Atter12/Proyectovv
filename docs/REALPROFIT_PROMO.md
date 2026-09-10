# Profit — análisis de campañas en Ads Holistic

## Qué es

`/profit` (nav: debajo de **Pago**):

**Gratis (Holistic)**  
Gasto TikTok, live, ranking, CTR/CPC/CPM, pacing, señales, fee / BE ROAS.

**Extra · Real Profit COD · +$20 / mes**  
Pedidos cobrados, ROAS/CPA COD, tienda Shopify vía app Real Profit.

`/gastos` redirige a `/profit`.

**Handoff implementación 2026-09-10:** [`HANDOFF_REALPROFIT_COD_2026-09-10.md`](./HANDOFF_REALPROFIT_COD_2026-09-10.md)

## Cobro del extra (+$20)

**No WhatsApp.** Misma cuenta BCP Holistic:

1. `/profit` → “Pagar $20 / mes” → depósito + voucher  
2. Gerente revisa en **`/payments/profit`** (Pagos Profit)  
3. Al aprobar → entitlement activo + auto-link tienda (sin cartera TikTok)  
4. `/profit` muestra cobrado si hay `rp_orders`

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
