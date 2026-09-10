# Plan · Real Profit COD — Shopify App Store + Meta `ads_read`

**Estado:** cobro + Pagos Profit **shipped** (2026-09-10). Meta sigue en espera.  
**Handoff:** [`HANDOFF_REALPROFIT_COD_2026-09-10.md`](./HANDOFF_REALPROFIT_COD_2026-09-10.md)  
**Repos:** `realprofitcod` (motor) + Ads Holistic `Proyectovv` (`/profit` + upsell +$20)

**Cobro del extra:** [`PLAN_REALPROFIT_COBRO_MANUAL.md`](./PLAN_REALPROFIT_COBRO_MANUAL.md) · cola gerente `/payments/profit`.

---

## Contexto (hoy)

| Pieza | Estado |
|-------|--------|
| Profit Holistic gratis | Gasto TikTok + live / ranking / fee |
| Extra Real Profit COD **+$20** | Pedidos + cobrado COD → ROAS cobrado |
| Cobro +$20 | Depósito BCP + voucher → **Pagos Profit** (no WA, no cartera) |
| Shopify en RP | App Store publicada; auto-link al **aprobar** pago si hay `shop_domain` |
| Meta en RP | Falta App Review / Live `ads_read` |
| Holistic ↔ RP | Misma Postgres |

---

## Trigger A — Shopify live · **hecho (cobro + cola)**

Ver handoff. Pendiente fino: smoke E2E + link si instalan después del pago.

## Trigger B — `meta lista`

Sin cambios: no implementar hasta frase trigger.

## Orden

```
0. Cobro +$20 voucher     ✅
1. Shopify link + cobrado ✅ (al aprobar; mejorar post-install)
2. Meta live              ⏳
```

## Referencias

- [`HANDOFF_REALPROFIT_COD_2026-09-10.md`](./HANDOFF_REALPROFIT_COD_2026-09-10.md)
- [`REALPROFIT_PROMO.md`](./REALPROFIT_PROMO.md)
- Código: `lib/realprofit/*`, `features/profit/*`, `app/(dashboard)/payments/profit/*`, `app/api/profit/*`
