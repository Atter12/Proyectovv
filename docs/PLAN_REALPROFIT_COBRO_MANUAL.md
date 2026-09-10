# Plan · Real Profit COD +$20 — cobro manual (voucher)

**Estado:** **shipped** en `main` (2026-09-10) — migration 027 corrida en prod.  
**Handoff completo:** [`HANDOFF_REALPROFIT_COD_2026-09-10.md`](./HANDOFF_REALPROFIT_COD_2026-09-10.md)  
**Repos:** Ads Holistic `Proyectovv` (cobro + UX `/profit`) · motor pedidos en `realprofitcod`

---

## Decisión comercial

| Antes | Ahora |
|-------|--------|
| CTA → WhatsApp | **No.** Depósito BCP + voucher |
| Activación por chat | Gerente aprueba en **`/payments/profit`** |
| — | Al aprobar: entitlement 30d + auto-link tienda; **sin** cartera ads |

---

## Flujo (prod)

```
/profit → Pagar $20 → misma cuenta BCP → voucher
  → gerente /payments/profit → Aceptar
  → sub active + link rp_store (shop_domain) → cobrado en Profit
```

---

## Implementado

- [x] Migration `027_hecom_cliente_realprofit_subs.sql`
- [x] `POST /api/profit/subscribe` (`purpose=realprofit_cod`, status `requires_payment`)
- [x] Proof + review; approve sin wallet
- [x] Modal Profit sin WhatsApp
- [x] Nav **Pagos Profit** (staff)
- [x] Auto-link al aprobar por `shop_domain`
- [x] Emails gerentes → `/payments/profit`

## Pendiente

- [ ] Smoke E2E prod
- [ ] Auto-link si instalan Shopify **después** del pago
- [ ] Meta live (otro doc)
