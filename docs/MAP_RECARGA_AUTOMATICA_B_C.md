# Mapa — Recarga automática (Opción B + C)

> **Estado:** diseño / no implementado  
> **Repo:** Proyectovv (`adsholistic.com`)  
> **Decisión:** combinar **B** (calendario) y **C** (umbral de saldo). Comparten tarjeta guardada y motor de cobro.

---

## Resumen ejecutivo

| | **Opción B — Por calendario** | **Opción C — Por umbral** |
|---|------------------------------|---------------------------|
| **Qué hace** | Cobra cada X días (15, 20, 30…) monto fijo | Si cartera &lt; umbral → cobra monto de recarga |
| **Ejemplo** | “$500 cada 15 días” | “Si bajo de $100, recargá $300” |
| **Disparador** | Cron diario + `next_charge_at` | Cron cada N horas + saldo wallet |
| **UI cliente** | “Programar recarga” | “Auto-recarga cuando baje el saldo” |
| **Puede convivir** | Sí — reglas con prioridad (ver §6) | Sí |

**Hoy:** solo recarga manual (Stripe Checkout one-shot). Campos `auto_recharge_enabled` / `recharge_threshold_cents` en `ad_accounts` existen pero **no cobran tarjeta**.

---

## Flujo de dinero (igual que hoy, automatizado)

```
Tarjeta guardada (Stripe Customer + PaymentMethod)
        ↓
Cobro off-session (PaymentIntent) — bruto = neto + fee Hecom
        ↓
Webhook payment_intent.succeeded
        ↓
confirm_deposit_with_fee (RPC 014) → cartera Holistic
        ↓
(opcional v2) auto-asignar a cuenta ads TikTok
```

**Fee:** mismo que depósito manual → `tiktok_default_fee` Hecom → fallback 10% (`resolve-hecom-deposit-fee.server.ts`).

---

## Qué reutiliza del código actual

| Pieza existente | Uso en B/C |
|-----------------|------------|
| `lib/payments/create-intent.server.ts` | Extender para `source: scheduled \| threshold` |
| `lib/payments/deposit-fee.ts` | Mismo cálculo neto/bruto |
| `lib/payments/providers/stripe.provider.ts` | Nuevo: SetupIntent + charge off-session |
| `014_deposit_credit_amount_fee.sql` | Mismo ledger al confirmar |
| `app/api/jobs/tiktok/sync/route.ts` | Patrón cron (`x-cron-secret`) |
| `ad_accounts.auto_recharge_*` | **Opción C v1 a nivel wallet** (mover o duplicar a org/wallet) |

---

## Modelo de datos propuesto

### 1. `billing_customers` (tarjeta guardada — compartido B+C)

```sql
-- Por organización (1 cliente Holistic = 1 org personal)
organization_id          uuid PK/FK
stripe_customer_id       text NOT NULL
default_payment_method_id text  -- pm_...
card_brand               text    -- visa, mastercard
card_last4               text
card_exp_month           int
card_exp_year            int
status                   text    -- active | detached | requires_action
created_at, updated_at
```

### 2. `auto_recharge_rules` (una fila activa por org; tipos B y/o C)

```sql
id                       uuid PK
organization_id          uuid FK
hecom_cliente_id         text    -- fee + scope
rule_type                text    -- 'calendar' | 'threshold' | 'both'
enabled                  boolean

-- Opción B (calendario)
calendar_enabled         boolean
calendar_interval_days   int     -- 15 | 20 | 30
calendar_credit_cents    bigint  -- neto en cartera
calendar_next_charge_at  timestamptz
calendar_timezone        text DEFAULT 'America/Lima'

-- Opción C (umbral)
threshold_enabled        boolean
threshold_min_cents      bigint  -- si available < esto
threshold_topup_cents    bigint  -- cobrar este neto

-- Post-cobro (v2)
auto_allocate_enabled    boolean DEFAULT false
auto_allocate_ad_account_id uuid FK ad_accounts NULL

-- Control
last_charge_at           timestamptz
last_charge_status       text    -- succeeded | failed | skipped
consecutive_failures     int DEFAULT 0
max_failures_before_pause int DEFAULT 3
metadata                 jsonb
```

### 3. `auto_recharge_attempts` (auditoría)

```sql
id, rule_id, organization_id, payment_intent_id,
trigger_type ('calendar' | 'threshold' | 'manual'),
credit_cents, gross_cents, fee_cents,
status, stripe_payment_intent_id, error_message,
created_at
```

### 4. Deprecación / migración `ad_accounts.auto_recharge_*`

- **v1:** regla a nivel **wallet/org** (más simple; el cliente recarga cartera, asigna después).
- **v2:** opcional por `ad_account_id` si quieren umbral por cuenta ads.

---

## Opción B — Por calendario (detalle)

### UX cliente (Pagos → “Recarga programada”)

1. **Guardar tarjeta** — Stripe Checkout `mode=setup` o Payment Element.
2. Configurar:
   - Monto neto en cartera (ej. $500)
   - Cada cuántos días: **15 | 20 | 30** (estandarizar; evitar 20 si no hace falta)
   - Vista previa: “Se cobrarán $550 (fee 10%) cada 15 días”
3. Activar / pausar / cambiar monto / quitar tarjeta.

### Lógica cron (`GET /api/jobs/auto-recharge`)

```
Diario 08:00 America/Lima (Vercel Cron):
  FOR rule WHERE enabled AND calendar_enabled AND calendar_next_charge_at <= now():
    IF tiene payment_method activo:
      crear payment_intent (source=scheduled)
      stripe.charge off_session
    ELSE → notificar “actualizá tarjeta”
    calendar_next_charge_at += interval_days
```

### Stripe técnico

1. `POST /v1/customers` — email del cliente
2. `Checkout Session mode=setup` → `setup_intent` → guardar `payment_method`
3. Cobro recurrente:
   ```http
   POST /v1/payment_intents
   amount={gross_cents}
   customer={cus_...}
   payment_method={pm_...}
   off_session=true
   confirm=true
   metadata[payment_intent_id]={uuid interno}
   metadata[source]=scheduled
   ```
4. Webhook `payment_intent.succeeded` → mismo handler que hoy + `auto_recharge_attempts`

### Casos borde

| Caso | Acción |
|------|--------|
| Tarjeta requiere 3DS | `requires_action` → email + pausar hasta que cliente re-autentique |
| 3 fallos seguidos | Pausar regla + notificación |
| Cliente pausa | `enabled=false`, no borrar tarjeta |
| Cambio de fee en Hecom | Aplica en el **próximo** cobro |

---

## Opción C — Por umbral (detalle)

### UX cliente (Pagos → “Auto-recarga por saldo”)

1. Misma tarjeta guardada (compartida con B).
2. Configurar:
   - **Cuando mi saldo baje de:** $X
   - **Recargar:** $Y (neto)
3. Toggle on/off.

### Lógica cron (`GET /api/jobs/auto-recharge` — mismo job)

```
Cada 4–6 horas:
  FOR rule WHERE enabled AND threshold_enabled:
    balance = v_wallet_ledger_balances.available_balance_cents
    IF balance < threshold_min_cents:
      IF último intento hace < 24h AND status=failed → skip (anti-spam)
      IF ya hay intent pending → skip
      crear payment_intent (source=threshold)
      stripe.charge off_session
```

### Anti-abuso

- **Cooldown:** mínimo 24h entre intentos fallidos del mismo trigger.
- **Techo diario:** máx. 1 cobro threshold por día (configurable).
- **Techo mensual:** opcional (ej. no más de $5k/mes auto).

---

## Convivencia B + C (prioridad)

Si el cliente activa **ambos**:

1. **Calendario** tiene prioridad el día que toca (`next_charge_at`).
2. **Umbral** solo corre si no hubo cobro calendar exitoso en las últimas 12h.
3. Nunca dos cobros simultáneos → lock por `organization_id` (advisory lock o `processing` flag en rule).

---

## API nuevas (borrador)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/billing/setup-session` | Crea Checkout Setup / guardar tarjeta |
| GET | `/api/billing/payment-method` | Estado tarjeta (last4, exp) |
| DELETE | `/api/billing/payment-method` | Desvincular tarjeta |
| GET | `/api/auto-recharge/rule` | Regla actual del cliente |
| PUT | `/api/auto-recharge/rule` | Crear/actualizar B y/o C |
| POST | `/api/auto-recharge/pause` | Pausar |
| GET | `/api/jobs/auto-recharge` | Cron (secret header) |

**Permisos:** solo `wallet:deposit` del cliente; gerente **no** configura tarjeta ajena.

---

## UI — pantallas

### Pagos (cliente)

```
┌─────────────────────────────────────────┐
│ Tarjeta guardada: •••• 4242  Exp 12/28   │
│ [Cambiar tarjeta]  [Quitar]              │
├─────────────────────────────────────────┤
│ ○ Recarga programada (cada X días)       │
│   Monto neto: [____]  Cada: [15▼] días   │
├─────────────────────────────────────────┤
│ ○ Auto-recarga por saldo                 │
│   Si bajo de: [____]  Recargar: [____]   │
├─────────────────────────────────────────┤
│ Fee Holistic: 10% · Preview cobro bruto  │
│ [Guardar configuración]                  │
└─────────────────────────────────────────┘
```

### Historial

- Nueva pestaña o filtro en wallet-tx: `Automática (programada)` / `Automática (umbral)`.

---

## Fases de implementación

### Fase 1 — Infra compartida (B+C)
- [ ] Migración `billing_customers`, `auto_recharge_rules`, `auto_recharge_attempts`
- [ ] Stripe SetupIntent + guardar PM
- [ ] `chargeOffSession()` en `stripe.provider.ts`
- [ ] Extender webhook para `source=scheduled|threshold`
- [ ] Job `/api/jobs/auto-recharge`
- [ ] `vercel.json` crons

### Fase 2 — Opción C (umbral) — más simple, valor rápido
- [ ] UI umbral en Pagos
- [ ] Cron threshold + cooldown
- [ ] Emails: éxito / fallo / tarjeta vencida

### Fase 3 — Opción B (calendario)
- [ ] UI programación 15/30 días
- [ ] `next_charge_at` + timezone Lima
- [ ] Pausa tras N fallos

### Fase 4 — Opcional
- [ ] Auto-asignar a cuenta ads post-cobro
- [ ] Umbral por `ad_account` (reusar columnas 009)
- [ ] Admin: ver reglas activas por cliente

---

## Vercel Cron (ejemplo)

```json
{
  "crons": [
    {
      "path": "/api/jobs/auto-recharge?mode=calendar",
      "schedule": "0 13 * * *"
    },
    {
      "path": "/api/jobs/auto-recharge?mode=threshold",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

`13:00 UTC` ≈ 08:00 Lima.

---

## Notificaciones (mínimo)

| Evento | Canal |
|--------|-------|
| Cobro exitoso | Email + notificación in-app |
| Tarjeta rechazada | Email + banner en Pagos |
| Requiere autenticación 3DS | Email con link a “actualizar pago” |
| Regla pausada por fallos | Email a cliente + opcional alerta gerente |

---

## Preguntas abiertas para operaciones

1. ¿Intervalos permitidos? Recomendado: **15 y 30 días** (+ mensual = 30).
2. ¿Monto mínimo/máximo auto? (ej. min $50, max $2,000 por cobro)
3. ¿Auto-asignar a TikTok en v1 o solo cartera?
4. ¿Cliente puede tener B y C activos a la vez?
5. ¿Qué hacer si fee Hecom cambia mid-cycle?

---

## Respuesta para clientes (copy)

> “Podés dejar tu tarjeta guardada y elegir: **(1)** que te cobremos cada X días un monto fijo, o **(2)** que cuando tu saldo baje de un monto, recarguemos automáticamente. En ambos casos aplicamos el mismo fee Holistic que en una recarga manual; el cobro suma saldo a tu cartera para que sigas asignando a tus cuentas ads.”

---

## Archivos a tocar (cuando se implemente)

```
supabase/migrations/019_auto_recharge_billing.sql
lib/payments/stripe-customer.server.ts          (nuevo)
lib/payments/stripe-off-session.server.ts       (nuevo)
lib/payments/auto-recharge/engine.server.ts   (nuevo)
lib/payments/providers/stripe.provider.ts       (extender)
app/api/billing/setup-session/route.ts
app/api/auto-recharge/rule/route.ts
app/api/jobs/auto-recharge/route.ts
features/payments/components/AutoRechargeSettings.client.tsx
vercel.json                                     (crons)
```
