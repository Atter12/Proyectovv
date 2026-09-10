# Handoff · Real Profit COD (+$20) — qué se hizo (2026-09-10)

**Para agentes / equipo Proyectovv.** No reabrir WhatsApp como CTA de cobro.  
**Repos:** esta app (Ads Holistic) + motor pedidos en `realprofitcod` (misma Postgres).  
**Commits:** `15a2210` (feature) · `0266857` (fix status TypeScript).

---

## Producto (decisión king)

| Tema | Decisión |
|------|----------|
| Cobro +$20 / mes | Depósito **manual misma cuenta BCP** Holistic + voucher + revisión gerente |
| WhatsApp | **Fuera** del flujo de pago |
| Cartera ads | **No** se acredita al aprobar Real Profit |
| Tienda Shopify | Ideal: **ya instalada** en Real Profit → al aprobar se **auto-linkea** |
| Meta Ads | Fuera de este corte |

---

## Flujo vivo

```
Cliente /profit → Conectar → oferta $40→$20
  → Pagar $20 / mes
  → ve cuenta BCP · deposita USD 20 · sube voucher
  → intent purpose=realprofit_cod · status processing · pending_review

Gerente /payments/profit  (nav: “Pagos Profit”, solo staff)
  → ve cola como Pagos manuales
  → Aceptar / Rechazar
  → Aceptar:
       1) hecom_cliente_realprofit_subs → active (+30 días)
       2) auto-link hecom_cliente_id ↔ rp_stores (por shop_domain del pago)
       3) NO ledger / NO wallet credit
  → Email gerentes: subject [Profit COD] · link /payments/profit
```

---

## Archivos clave

| Área | Path |
|------|------|
| Migration | `supabase/migrations/027_hecom_cliente_realprofit_subs.sql` (**ya corrida en prod**) |
| Entitlement | `lib/realprofit/subscription.server.ts` |
| Crear intent $20 | `lib/realprofit/create-subscribe-intent.server.ts` |
| API | `app/api/profit/subscribe/route.ts` · `GET/POST` |
| Approve branch | `lib/payments/review-manual-payment.server.ts` → `approveRealProfitCodVoucher` |
| Auto-link | `lib/realprofit/profit-snapshot.server.ts` → `autoLinkRpStoreForCliente` |
| Cola gerente | `app/(dashboard)/payments/profit/page.tsx` |
| Host UI | `features/payments/components/RealProfitVoucherReviewHost.tsx` |
| Cards review | `features/payments/components/ManualVoucherReviewSection.client.tsx` (`product="realprofit"`) |
| Modal cliente | `features/profit/components/ProfitPageClient.client.tsx` |
| Lista cola | `services/payments.service.ts` → `listRealProfitVoucherReviewsForStaff` |
| Nav | `config/navigation.ts` · `routes.paymentsProfit` · icon `payments-profit` |
| Emails | `lib/email/manual-payment-notify.server.ts` (purpose → `/payments/profit`) |

**Importante:** intents con `purpose=realprofit_cod` / `source=profit_subscribe` **no** aparecen en Pagos manuales (cartera).

---

## Status de payment_intents

Usar solo `DbPaymentStatus`: `created` \| `requires_payment` \| `processing` \| `succeeded` \| `failed` \| `cancelled`.  
**No** usar `requires_action` (rompió el build Vercel).

Tras crear subscribe → `requires_payment` + `manual_review_status=awaiting_proof`.  
Tras voucher → `processing` + `pending_review`.

---

## DB compartida

Misma Postgres Holistic ↔ Real Profit (`getRealProfitAdmin` = `createAdminClient`).  
Tablas nuevas/uso: `hecom_cliente_realprofit_subs`, `hecom_cliente_rp_stores`, `rp_stores`, `rp_orders`, `payment_intents`.

---

## Pendiente (no hecho)

- [x] Si tienda se instala **después** del pago: `POST /api/profit/link-retry` + CTA “Ya instalé — vincular” en `/profit`
- [ ] Smoke E2E en prod: pagar → aparece en Pagos Profit → aceptar → cobrado en `/profit`
- [ ] Renovación mensual / expiración UI
- [ ] Meta `ads_read` (otro plan)

Docs relacionados: `PLAN_REALPROFIT_COBRO_MANUAL.md` · `PLAN_REALPROFIT_SHOPIFY_META.md` · `REALPROFIT_PROMO.md`
