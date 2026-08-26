# Spec — Recarga en PEN v1

> **Estado:** diseño aprobado para implementar  
> **Repo:** Proyectovv · `adsholistic.com`  
> **Objetivo:** que el cliente pueda pagar **soles exactos** en tarjeta/Yape (sin conversión rara de Stripe al checkout) y que la cartera siga en **USD** (TikTok/ads).

---

## 1. Problema hoy

| Paso | Qué pasa |
|------|----------|
| Cliente pide neto | Ej. **$110 USD** en cartera |
| Holistic calcula | Fee 10% → cobro **$121 USD** |
| Stripe Checkout | Crea sesión en **USD** |
| Cliente elige PEN | Stripe convierte → **S/ 420.35** (tipo cambio Stripe, no redondo) |

**Dolor:** el cliente peruano quiere ver y pagar **S/ 400 o S/ 420 exactos**, no centavos raros por FX de Stripe.

---

## 2. Solución v1 (recomendada)

**Dos caminos en Pagos**, misma cartera USD:

| Modo | Cliente ve | Tarjeta cobra | Cartera acredita |
|------|------------|---------------|------------------|
| **USD** (actual) | Neto $110 → cobro $121 | **$121.00 USD** | **$110 USD** |
| **PEN** (nuevo) | Neto S/ 382 → cobro S/ 420.20 | **S/ 420.20 PEN** exacto | **~$110 USD** (según TC Holistic) |

**Regla de oro:** el monto en **PEN es exacto en la pasarela**. La conversión a USD de cartera usa un **tipo de cambio fijado al crear el intent** (no el de Stripe Adaptive Pricing).

---

## 3. Decisiones de negocio (defaults v1)

| Tema | Decisión v1 | Notas |
|------|-------------|-------|
| Moneda cartera | **USD** (sin cambio) | TikTok y Hecom en dólares |
| Quién fija el TC | **Holistic** al crear intent | Evita sorpresas en checkout |
| Fuente TC | Env `HOLISTIC_USD_PEN_RATE` o API SUNAT diaria | Fallback manual si API falla |
| Fee 10% | Sobre el **neto en la moneda de cobro** | S/ 382 neto → S/ 42.20 fee → S/ 420.20 bruto |
| Pasarela PEN v1 | **Stripe `currency=pen`** | Rápido; Culqi/Cobrana en v2 |
| Mín / máx PEN | S/ 50 – S/ 50,000 | Ajustable por env |
| Redondeo | Centavos PEN (2 decimales) | `Math.round(x * 100)` |

**Ejemplo numérico** (TC venta = **3.47**):

```
Cliente quiere ~$110 USD en cartera
  → neto PEN = 110 × 3.47 = S/ 381.70
  → fee 10% = S/ 38.17
  → cobro tarjeta = S/ 419.87  (exacto en Stripe PEN)
  → cartera = 381.70 / 3.47 = $110.00 USD
```

O el cliente escribe directo **S/ 420** bruto y el sistema invierte el cálculo.

---

## 4. UX — modal Recargar cartera

```
┌─────────────────────────────────────────────┐
│ Recargar cartera                            │
│                                             │
│ Moneda de pago:  ( • USD )  ( ○ PEN )       │
│                                             │
│ Quiero en cartera:  [ 110.00 ] USD          │
│   ≈ S/ 381.70 al tipo 3.47 (solo informativo)│
│                                             │
│ ─── si elige PEN ───                        │
│ Quiero en cartera:  [ 381.70 ] PEN          │
│   ≈ $ 110.00 USD en cartera                 │
│                                             │
│ Fee Holistic (10%):     S/ 38.17 / $ 11.00  │
│ Se cobra en tarjeta:    S/ 419.87 / $ 121   │
│ Tipo de cambio:         1 USD = 3.47 PEN    │
│ (fijado al confirmar, válido 30 min)        │
│                                             │
│ Pasarela: Stripe                            │
│ [ Confirmar depósito ]                      │
└─────────────────────────────────────────────┘
```

**Copy legal corto:**  
*"El tipo de cambio se fija al confirmar. La cartera opera en USD; el monto en soles es el que se debita de tu tarjeta."*

---

## 5. Flujo técnico

```
1. POST /api/payments/intents
   body: { amount, currency: "PEN"|"USD", provider: "stripe", inputMode: "desired_credit" }

2. resolveDepositFeeForSession (fee % Hecom, igual que hoy)

3. Si currency === "PEN":
   - rate = getHolisticUsdPenRate()  // ej. 3.47
   - creditPenCents = round(amount * 100)
   - grossPenCents = round(creditPenCents * (1 + fee%/100))
   - creditUsdCents = round(creditPenCents / rate)   // lo que entra a cartera
   - metadata: charge_currency, fx_rate, credit_usd_cents, credit_pen_cents, gross_pen_cents

4. payment_intents row:
   - amount_cents = grossPenCents (bruto cobrado)
   - currency = "PEN"
   - metadata.credit_amount_cents = creditUsdCents  ← ledger acredita USD

5. stripe.provider createCheckout:
   - currency: "pen"
   - unit_amount: grossPenCents
   - NO adaptive pricing / NO multi-currency en checkout (forzar PEN)

6. Webhook payment_intent.succeeded:
   - validar amount === grossPenCents && currency === pen
   - ledger_confirm_deposit → acredita creditUsdCents en wallet USD
```

---

## 6. Cambios en base de datos

**v1 sin migración obligatoria** — todo en `payment_intents.metadata`:

```json
{
  "input_mode": "desired_credit",
  "charge_currency": "PEN",
  "fx_rate_usd_pen": 3.47,
  "fx_locked_at": "2026-08-26T18:00:00Z",
  "credit_amount_cents": 11000,
  "credit_currency": "USD",
  "credit_pen_cents": 38170,
  "gross_pen_cents": 41987,
  "fee_percent": 10,
  "fee_pen_cents": 3817
}
```

**v2 opcional:** tabla `fx_rates` (date, usd_pen, source).

**Ledger:** `ledger_confirm_deposit` ya usa `metadata.credit_amount_cents` — seguir pasando **USD cents** para acreditar cartera aunque `payment_intents.currency` sea PEN.

---

## 7. API

### Request extendido

```typescript
POST /api/payments/intents
{
  "amount": 381.70,           // neto en moneda elegida
  "currency": "PEN",          // "USD" | "PEN"
  "provider": "stripe",
  "hecomClienteId": "..."
}
```

### Response (igual estructura, campos extra opcionales)

```typescript
{
  "paymentIntentId": "...",
  "grossCents": 41987,
  "creditCents": 11000,       // siempre USD para cartera
  "feeCents": 3817,
  "feePercent": 10,
  "chargeCurrency": "PEN",
  "fxRateUsdPen": 3.47,
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

### Nuevo endpoint (opcional v1)

```
GET /api/payments/fx-rate
→ { usdPen: 3.47, source: "env"|"sunat", asOf: "2026-08-26" }
```

---

## 8. Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `lib/payments/deposit-fee.ts` | `depositFromDesiredCreditPen()` o param `currency` |
| `lib/payments/fx-rate.server.ts` | **nuevo** — leer env / API SUNAT |
| `lib/payments/create-intent.server.ts` | Rama PEN + metadata |
| `lib/payments/providers/stripe.provider.ts` | Checkout PEN; desactivar adaptive pricing si aplica |
| `app/api/payments/intents/route.ts` | Validar `currency` |
| `features/payments/components/AddBalanceModal.client.tsx` | Toggle USD/PEN + preview |
| `lib/env/env.server.ts` | `HOLISTIC_USD_PEN_RATE`, `FX_RATE_SOURCE` |
| `supabase/migrations/019_pen_deposit_metadata.sql` | Solo si queremos columna `credit_currency` |

---

## 9. Stripe — checklist cuenta

- [ ] Cuenta Stripe acepta cargos en **PEN** (Perú)
- [ ] Checkout Session: `currency=pen`, `unit_amount` en céntimos (×100)
- [ ] Probar que **no** aparece selector USD/PEN en checkout (solo PEN) — evita Adaptive Pricing
- [ ] Webhook valida `currency` del evento

**Stripe API (forzar PEN único):**

```
line_items[0][price_data][currency]=pen
line_items[0][price_data][unit_amount]=41987
# No habilitar adaptive_pricing en Dashboard para estas sesiones
```

---

## 10. Fases

### Fase 1 — MVP (3–5 días) ← **hacer esto primero**

- [ ] `HOLISTIC_USD_PEN_RATE` en Vercel (ej. 3.47, actualizar manual 1×/día)
- [ ] Toggle USD/PEN en modal
- [ ] Intent + Stripe checkout en PEN
- [ ] Metadata + acreditar USD en cartera
- [ ] Prueba E2E: S/ 420.00 exacto en tarjeta test

### Fase 2 — Pulido (2–3 días)

- [ ] API SUNAT tipo cambio automático (cron diario)
- [ ] Historial wallet muestra “Pagaste S/ X · acreditado $Y”
- [ ] Email confirmación con ambas monedas

### Fase 3 — Pasarela local (1–2 semanas, paralelo)

- [ ] **Cobrana** o **Culqi** en PEN (Yape/Plin)
- [ ] Misma lógica FX + metadata
- [ ] Ver `docs/REUNION_COBRANA_PAUTAS.md`

---

## 11. Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| TC sube después del pago | TC **bloqueado en intent**; cliente ve preview antes de pagar |
| Stripe no soporta PEN | Fallback Culqi/Cobrana; mantener USD |
| Cliente confundido USD vs PEN | UI siempre muestra ambos en preview |
| Webhook en moneda distinta | Validar `currency` + `amount` antes de acreditar |
| Fee mal calculado en PEN | Tests unitarios con ejemplos de la sección 3 |

---

## 12. Tests mínimos

```typescript
// deposit PEN: neto 381.70, fee 10%, rate 3.47
// → grossPen 419.87, creditUsd 11000

// deposit USD: neto 110, fee 10%
// → grossUsd 12100 (sin cambio)

// webhook: PEN 41987 → credit 11000 USD
```

---

## 13. Env vars nuevas

```env
# Tipo de cambio venta Holistic (1 USD = X PEN)
HOLISTIC_USD_PEN_RATE=3.47

# opcional: sunat | manual
FX_RATE_SOURCE=manual

# Límites depósito PEN
DEPOSIT_MIN_PEN=50
DEPOSIT_MAX_PEN=50000
```

---

## 14. Mensaje para clientes / demo

> "Podés recargar en **dólares** o en **soles**. Si elegís soles, te cobramos el monto **exacto en PEN** que ves en pantalla (ej. S/ 420.00). Ese pago se convierte a dólares en tu cartera al tipo de cambio del día que te mostramos antes de pagar. Tus campañas en TikTok siguen gastando en USD."

---

## 15. Fuera de scope v1

- Cartera dual PEN + USD
- Cobro recurrente en PEN (ver `docs/MAP_RECARGA_AUTOMATICA_B_C.md`)
- Facturación electrónica SUNAT
- Tipo de cambio compra vs venta distinto por cliente

---

## 16. Prompt para Cursor (implementar)

```
Leé docs/SPEC_RECARGA_PEN_V1.md.
Implementá Fase 1: toggle USD/PEN en AddBalanceModal, fx-rate.server.ts con HOLISTIC_USD_PEN_RATE,
rama PEN en create-intent.server.ts, Stripe checkout currency=pen, metadata credit USD,
ledger acredita credit_amount_cents en USD. Tests unitarios deposit-fee PEN.
No romper flujo USD actual.
```
