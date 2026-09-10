# Plan · Real Profit COD +$20 — cobro manual (voucher)

**Estado:** listo para implementar (Shopify App Store ya publicada).  
**Actualizado:** 2026-09-10  
**Repos:** Ads Holistic `Proyectovv` (cobro + UX `/profit`) · motor pedidos en `realprofitcod`

---

## Decisión comercial (king / alianza Ads Holistic)

| Antes | Ahora |
|-------|--------|
| CTA modal → WhatsApp “Pagar por ahora” | **No.** WhatsApp queda fuera del flujo de pago |
| Activación manual por chat | Cliente **deposita $20** a la **misma cuenta de pago manual** Holistic |
| — | Sube **voucher** → staff **revisa** (igual que recargas) → si OK, se habilita el extra |
| Conectar Shopify | Tras pago aprobado: **Instalar app Real Profit** en Shopify (OAuth / App Store) + **jale automático** de pedidos |

Meta Ads (`ads_read`) **no** entra en este corte.

---

## Flujo UX en `/profit`

```
1. Cliente ve Profit gratis (gasto TikTok)
2. Sección “Conectá tu tienda” → Conectar → modal oferta $40 → $20
3. CTA principal: “Pagar $20 / mes”  (NO WhatsApp)
4. Modal depósito manual:
   - Monto fijo USD 20 (sin fee de cartera ads)
   - Misma cuenta BCP / CCI que Add Balance (`getManualBankAccounts`)
   - Cliente deposita → sube voucher → estado “en revisión”
5. Staff aprueba en /admin/payments (mismo panel voucher)
6. Al aprobar:
   - NO se acredita saldo TikTok / cartera ads
   - Se marca entitlement Real Profit COD activo (mes)
7. UI desbloquea: “Instalar Real Profit en Shopify”
   - Deep link App Store / OAuth con shop domain
   - Tras install: auto-link `hecom_cliente_id` ↔ `rp_store_id` (mismo shop_domain)
   - `/profit` muestra cobrado + ROAS desde `rp_orders`
```

---

## Piezas técnicas

### 1. Entitlement (nuevo)

Tabla sugerida `hecom_cliente_realprofit_subs`:

| Columna | Notas |
|---------|--------|
| `hecom_cliente_id` | text PK o unique activo |
| `status` | `pending_payment` \| `active` \| `expired` \| `rejected` |
| `active_until` | timestamptz (pago aprobado + 30 días) |
| `last_payment_intent_id` | uuid → `payment_intents` |
| `created_at` / `updated_at` | |

Alternativa v0: metadata en fila link + flag en org; preferir tabla dedicada.

### 2. Payment intent

- `provider = manual` (reutilizar voucher / proof / review)
- `metadata.purpose = "realprofit_cod"`
- `metadata.hecom_cliente_id = …`
- Monto: **2000 cents USD** fijo (gross = $20; **sin** `depositFromDesiredCredit` fee Holistic)
- Al crear: no tratar como recarga de cartera

### 3. Aprobación voucher

En `approveManualVoucherPayment`:

```
if metadata.purpose === "realprofit_cod":
  → activar / extender hecom_cliente_realprofit_subs
  → NO llamar ledger confirm_deposit / crédito wallet
else:
  → flujo actual (acreditar cartera)
```

Rechazo: mismo path actual + status entitlement `rejected` / sigue sin COD.

### 4. UI Profit

- Quitar `REAL_PROFIT_WHATSAPP_URL` del CTA de pago
- Botón “Pagar $20 / mes” → modal depósito (cuenta + voucher)
- Si `status === active` y sin tienda: CTA **Instalar app Shopify** (App Store listing Real Profit COD)
- Si hay link `hecom_cliente_rp_stores`: KPIs cobrado (ya existe)

### 5. Install Shopify (fase B, mismo sprint si da tiempo)

- URL pública App Store o Partner install con `?shop=`
- Post-OAuth en `realprofitcod`: webhook / job que matchee `shop_domain` → upsert `hecom_cliente_rp_stores` si hay sub activa del cliente Holistic (pasar `hecom_cliente_id` en state OAuth o matchear por email/org)

---

## Cuenta bancaria

Reusar exactamente:

- `lib/payments/manual-bank-accounts.server.ts`
- Default: BCP · HOLISTIC MARKETING LLC · `1947376966005` · CCI `00219400737696600598`
- Env `MANUAL_PAYMENT_BANK_ACCOUNTS_JSON` si está seteado en prod

Misma UX de comprobante: bucket `payment-proofs`, emails gerentes ya existentes.

---

## Fuera de scope (este corte)

- Stripe / suscripción automática del +$20
- WhatsApp como paso de pago (puede quedar link de soporte aparte, no CTA de cobro)
- Meta `ads_read` (trigger B del plan Shopify/Meta)
- Cobrar fee Holistic encima de los $20

---

## Checklist implementación

- [x] Migration `027_hecom_cliente_realprofit_subs.sql` (aplicar en Supabase)
- [x] API `POST /api/profit/subscribe` → intent manual `purpose=realprofit_cod`
- [x] Reusar `POST …/proof` + review admin
- [x] Branch en approve: entitlement, **no** wallet
- [x] Modal Profit: pagar $20 → cuentas → voucher (sin WhatsApp)
- [x] Tras activo: CTA Instalar Shopify → `/api/shopify/auth`
- [x] Docs promo + plan Shopify/Meta
- [ ] Ops: correr migration `027` en prod
- [ ] Smoke end-to-end
- [ ] Auto-link hecom ↔ rp_store post-install (siguiente)

---

## Orden

1. **Cobro + entitlement** (este doc) — desbloquea producto sin esperar WA  
2. **Instalar Shopify + auto-link + sync** — jale automático de pedidos  
3. **Meta live** — después (`PLAN_REALPROFIT_SHOPIFY_META.md` trigger B)
