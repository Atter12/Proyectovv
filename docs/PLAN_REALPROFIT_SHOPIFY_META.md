# Plan · Real Profit COD — Shopify App Store + Meta `ads_read`

**Estado:** Shopify publicada → implementar cobro manual +$20 + install. Meta sigue en espera.  
**Actualizado:** 2026-09-10  
**Repos:** `realprofitcod` (motor) + Ads Holistic `Proyectovv` (vista `/profit` + upsell +$20)

**Cobro del extra:** ver [`PLAN_REALPROFIT_COBRO_MANUAL.md`](./PLAN_REALPROFIT_COBRO_MANUAL.md) (depósito BCP + voucher + revisión; **no** WhatsApp).

---

## Contexto (hoy)

| Pieza | Estado |
|-------|--------|
| Profit Holistic gratis | Gasto **TikTok** Holistic + live / ranking / fee |
| Extra Real Profit COD **+$20** | Pedidos + cobrado COD (`rp_orders`) → ROAS cobrado |
| Cobro +$20 | **Depósito manual misma cuenta Holistic** → voucher → review → entitlement. WhatsApp **fuera** del CTA de pago |
| Shopify en RP | **App Store publicada** → OAuth + sync órdenes listos para wire desde Holistic |
| Meta en RP | Código OAuth + sync Insights. Falta App Review / Live `ads_read` |
| Holistic ↔ RP | Misma Postgres; link `hecom_cliente_rp_stores`; fallback gasto TikTok si `rp_ad_spend_daily` vacío |
| Conectar Shopify desde Holistic | Hoy todavía CTA/WA en modal — **reemplazar** por pagar $20 → instalar app → jale automático |

**Frases trigger:**

1. **`publicacion shopify lista`** / “ya se publicó en Shopify” → **activo** (cobro manual + install).  
2. **`meta lista`** → gasto Meta automático vía app Real Profit.

Asumir APIs en orden: primero Shopify (ventas/cobrado), luego Meta.

---

## Trigger A — Shopify live (en curso)

### Qué desbloquea

Cliente Holistic paga **$20** (voucher) → instala **Real Profit** → pedidos COD a `rp_*` → `/profit` muestra cobrado real.

### Implementar

**Cobro (Proyectovv) — primero**

- [ ] Modal: quitar WA; CTA “Pagar $20 / mes”
- [ ] Intent `purpose=realprofit_cod`, $20 USD, misma cuenta BCP
- [ ] Voucher + review; al aprobar → entitlement (sin acreditar cartera ads)
- Detalle: [`PLAN_REALPROFIT_COBRO_MANUAL.md`](./PLAN_REALPROFIT_COBRO_MANUAL.md)

**Shopify (ambos repos) — después del pago**

- [ ] Deep link / install URL App Store con shop domain
- [ ] Auto-link `hecom_cliente_id` ↔ `rp_store_id` tras install
- [ ] `/profit`: tienda linkeada → KPIs cobrado; si no → CTA según estado (pagar / instalar)
- [ ] Docs: `REALPROFIT_PROMO.md` + `SALES_SOURCES_REALPROFIT.md`

### Fuera de scope en este trigger

- Meta auto-spend (trigger B)
- Woo / TikTok Shop
- Stripe suscripción del +$20

---

## Trigger B — `meta lista`

Sin cambios de fondo: App Live `ads_read` → sync `rp_ad_spend_daily` → Holistic prioriza `spendSource=realprofit`.

Ver sección original en historial git si hace falta el detalle; no implementar hasta frase trigger.

---

## Orden de APIs (regla)

```
0. Cobro +$20 voucher Holistic     → entitlement
1. Shopify live install + sync     → órdenes + cobrado
2. Meta live                       → ads_read spend
3. Después                         → TikTok Ads en RP / atribución fina
```

---

## Referencias

- Cobro: [`PLAN_REALPROFIT_COBRO_MANUAL.md`](./PLAN_REALPROFIT_COBRO_MANUAL.md)
- Promo: [`REALPROFIT_PROMO.md`](./REALPROFIT_PROMO.md), [`SALES_SOURCES_REALPROFIT.md`](./SALES_SOURCES_REALPROFIT.md)
- Código Holistic: `lib/realprofit/*`, `features/profit/*`, `app/api/profit/*`, `lib/payments/*`
- Código RP: `src/lib/shopify/*`, `src/lib/ads/meta/*`
