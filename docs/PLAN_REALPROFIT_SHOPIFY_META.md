# Plan · Real Profit COD — Shopify App Store + Meta `ads_read`

**Estado:** consulta / espera de triggers (no implementar hasta que digas la frase).  
**Actualizado:** 2026-09-08  
**Repos:** `realprofitcod` (motor) + Ads Holistic `Proyectovv` (vista `/profit` + upsell +$20)

---

## Contexto (hoy)

| Pieza | Estado |
|-------|--------|
| Profit Holistic gratis | Gasto **TikTok** Holistic + live / ranking / fee |
| Extra Real Profit COD **+$20** | Pedidos + cobrado COD (`rp_orders`) → ROAS cobrado |
| Shopify en RP | OAuth + embed + webhooks casi listos; **App Store pendiente de publicación** |
| Meta en RP | Código OAuth + sync Insights → `rp_ad_spend_daily` (`docs/ADS-META.md` en RP). Falta **App Review** / Live con `ads_read` (+ `business_management`) |
| Holistic ↔ RP | Misma Postgres; link `hecom_cliente_rp_stores`; fallback gasto TikTok si `rp_ad_spend_daily` vacío |
| Conectar Shopify desde Holistic | Hoy CTA / WhatsApp upsell — **no** OAuth completo hasta publicación |

**Frases trigger (exactas o equivalentes):**

1. **`publicacion shopify lista`** → implementar el extra +$20 end-to-end (Shopify live).  
2. **`meta lista`** → revisar beneficios extra + implementar gasto Meta automático vía app Real Profit.

Asumir APIs en orden: primero Shopify (ventas/cobrado), luego Meta (gasto ads del cliente fuera de TikTok Holistic).

---

## Trigger A — `publicacion shopify lista`

### Qué desbloquea

Cualquier cliente Holistic puede instalar **Real Profit** desde Shopify App Store → pedidos COD fluyen a `rp_*` → Holistic `/profit` muestra cobrado real y upsell **+$20** deja de ser “hablar por WA” y pasa a producto usable.

### Implementar (cuando digas la frase)

**En Real Profit (`realprofitcod`)**

- [ ] Confirmar app pública live (scopes, webhooks, billing Free o plan claro).
- [ ] Flujo install → `rp_stores` + `rp_shopify_sessions` + sync órdenes + estados COD.
- [ ] Deep link / install URL estable para Holistic (`shop` domain → install).
- [ ] Checklist post-publish: smoke COD (created → collected).

**En Ads Holistic (`Proyectovv`)**

- [ ] Reemplazar modal “solo WA” por: **Conectar Shopify → instalar RP** (domain → URL App Store / OAuth).
- [ ] Auto o semi-auto link `hecom_cliente_id` ↔ `rp_store_id` tras install (mismo shop_domain).
- [ ] `/profit`: si hay tienda linkeada → KPIs cobrado + ROAS; si no → CTA +$20.
- [ ] Flag / cobro del extra +$20 (Hecom o regla comercial acordada).
- [ ] Docs: actualizar `REALPROFIT_PROMO.md` + `SALES_SOURCES_REALPROFIT.md`.

### Beneficio concreto Holistic

- De “cuánto gastás en TikTok” → **cuánto cobraste COD** de la tienda.
- Upsell +$20 vendible y medible (no manual).

### Fuera de scope en este trigger

- Meta auto-spend (eso es trigger B).
- Woo / TikTok Shop (después).

---

## Trigger B — `meta lista`

### Qué desbloquea

App Meta **Real Profit COD** en modo Live con permiso **`ads_read`**: el cliente conecta su Facebook/Ads desde RP y el gasto Meta se jala solo a `rp_ad_spend_daily` (campaign level).

### Beneficios extra (además de Shopify)

| Antes | Con Meta live |
|-------|----------------|
| Gasto en Profit Holistic ≈ solo TikTok agency | Gasto **Meta del cliente** en el mismo ROAS cobrado |
| `rp_ad_spend_daily` vacío → fallback TikTok | Preferir spend RP (Meta + manual) |
| ROAS cobrado incompleto si el cliente pauta Meta | ROAS cobrado = cobrado COD ÷ (Meta + lo que haya en RP) |
| Dual counting riesgo | Sync Meta borra manual Meta del rango (ya en RP) |

### Implementar (cuando digas la frase)

**En Real Profit**

- [ ] Verificar App Review aprobado: `ads_read` (+ `business_management` si hace falta).
- [ ] Env prod: `META_APP_ID` / `SECRET` / redirect `…/api/ads/meta/callback`.
- [ ] UX: Conectar Meta → elegir ad account si hay varias → sync periódico (cron o botón).
- [ ] Persist `rp_ad_integrations` + Insights → `rp_ad_spend_daily` (`platform=meta`).

**En Ads Holistic**

- [ ] `/profit`: priorizar `spendSource=realprofit` cuando haya filas Meta; label claro “Gasto Meta (RP)”.
- [ ] No mezclar mal TikTok Holistic + Meta RP sin reglas (doc + UI: origen del gasto).
- [ ] CTA “Conectar Meta en Real Profit” si hay tienda pero no integración Meta.
- [ ] Opcional v2: atribución pedido→campaña (hoy cobrado por campaña = proporcional al spend).

### Beneficio concreto Holistic

- Clientes que pauten **Meta + venden COD Shopify** ven profit real sin cargar Excel.
- Holistic sigue siendo la puerta; RP es el motor de cobrado + ads no-TikTok.

---

## Orden de APIs (regla)

```
1. Shopify live  →  órdenes + cobrado   (+$20 producto)
2. Meta live     →  ads_read spend      (ROAS cobrado completo)
3. Después       →  TikTok Ads en RP / Google / atribución fina
```

No invertir: sin pedidos cobrados, el gasto Meta solo infla denominador sin historia COD.

---

## Criterios “listo”

**Shopify listo para implementar Holistic**

- App visible/instalable App Store (o link público Partner).
- Webhook órdenes → `collected` fiable en al menos 1 tienda real.
- URL de install documentada.

**Meta listo para implementar Holistic**

- App Live; usuario no-dev puede OAuth con `ads_read`.
- Sync escribe filas en `rp_ad_spend_daily` para esa store.
- Token long-lived / refresh path estable.

---

## Qué NO hacer hasta el trigger

- No tocar billing App Store ni App Review Meta “por adelantado” desde Holistic.
- No reactivar ideas cross-BM u otras en este plan.
- Cross-repo: cambios grandes de OAuth viven en `realprofitcod`; Holistic consume `rp_*` + UX/link.

---

## Referencias

- Holistic: `docs/REALPROFIT_PROMO.md`, `docs/SALES_SOURCES_REALPROFIT.md`
- RP: `docs/ADS-META.md`, `docs/SHOPIFY_ARCH.md`, `docs/APP_STORE_CHECKLIST.md`, `docs/ROADMAP-MAESTRO.md`
- Código Holistic: `lib/realprofit/*`, `features/profit/*`, `app/api/profit/*`
- Código RP: `src/lib/ads/meta/*`, `src/lib/shopify/*`, `src/app/api/ads/meta/*`
