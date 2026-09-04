# Plan — Crédito con tarjeta (Stripe) + cobro al retirar

**Estado:** solo diseño. **No implementar** hasta orden explícita.  
**Fecha:** 2026-09-03  
**Relacionado:** bridge cartera Holistic → cobros Hecom (ya live); `docs/REUNION_COBRANA_PAUTAS.md`; API Cobrana (pendiente).

---

## 1. Contexto

### Prepago (ya OK)
Cliente recarga cartera (Stripe / manual) → asigna a TikTok → Hecom ve cobro vía bridge `AH-STRIPE-*`.  
Riesgo bajo: paga antes de gastar.

### Crédito (falta afinar)
Cliente pide cupo (ej. $700–$800) → gasta → paga a fin de ciclo / cobranza.  
Riesgo: llega al tope o se va **sin pagar** (“desaparece”).

**Problema concreto:**  
Pide crédito $700 → guarda tarjeta → gasta $300 en 2 días → **quita la tarjeta** pensando “aún no debo el ciclo completo” → se va.  
Hoy no hay un gancho fuerte que cobre lo ya gastado al desvincular el medio de pago.

---

## 2. Idea de producto (acordada en conversación)

1. Crédito solo se **habilita** si hay **tarjeta guardada** en Stripe (PaymentMethod / Customer).
2. Cupo de crédito = tope (ej. $700).
3. Si el cliente **intenta quitar / desvincular la tarjeta** y aún tiene **gasto no cobrado** (spend + fee Hecom pendiente):
   - el sistema **cobra off-session** lo adeudado hasta ese momento (lo gastado, no necesariamente todo el cupo);
   - si el cobro OK → se puede liberar la tarjeta / cerrar crédito;
   - si el cobro falla → **no** se deja quitar la tarjeta; se bloquea cupo / cuentas y entra cobranza.
4. **Pago manual (BCP/voucher) no alcanza** para habilitar crédito “con salida fácil”: el **candado** del cupo = tarjeta on file (Stripe).
5. Manual / Cobrana siguen para **pagar** deuda o recargar en soles — no sustituyen el candado.

---

## 2.1 Decisión clara: Stripe = candado · Cobrana = pago en soles

No es “todo el crédito solo por Stripe”. Son **dos roles**:

| Rol | Quién | Para qué |
|---|---|---|
| **Candado anti-ghost** | **Stripe** | Guardar tarjeta + cobrar off-session si quita la tarjeta con deuda |
| **Pagar la deuda / recargar en PEN** | **Cobrana** (Yape/BCP/Monnet) + manual BCP | Comisión baja en soles (~0.75% PEN); el cliente no “paga el ciclo” por Stripe si no quiere |

### Por qué el candado no puede ser Cobrana
Cobrana crea un **cargo** y el deudor paga con link/código. **No** guarda tarjeta en Holistic ni cobra sin que el cliente esté pagando. Sin eso no hay cobro automático al “irse”.

### Por qué no forzar que paguen el ciclo en Stripe
Stripe cobra comisión más alta; a quien opera en **soles** no le conviene. Por eso:

1. Activa crédito → guarda tarjeta **Stripe** (candado, puede ser un hold/setup barato o sin cargo hasta el detach).
2. Gasta (ej. $300 de $700).
3. Paga el ciclo / abona en **soles con Cobrana** (o BCP) cuando toca cobranza.
4. Si intenta **sacar la tarjeta** con deuda → Stripe cobra lo gastado (o no lo deja salir).

### Si algún día no quieren Stripe como candado
Queda un producto más débil: tope de cupo + no fondear más + cobranza Hecom/Cobrana **sin** cobro automático al detach. Documentar como variante B si gerencia lo pide; no es el default de este plan.

---

## 3. Flujo resumido

```
Pide crédito $700
    → SetupIntent / save card (Stripe Customer + PaymentMethod)  ← CANDADO
    → Cupo activo (Hecom credito_form_slug + flag Holistic)

Gasta $300 (TikTok → gastos Hecom)
    → Deuda viva ≈ $300 + fee

Paga el ciclo en soles (opcional / cobranza)
    → Cobrana charge.paid o BCP → cobro Hecom          ← PAGO PEN

Quiere “quitar tarjeta” / cerrar crédito
    → Holistic calcula saldo pendiente (FIFO Hecom o snapshot)
    → PaymentIntent off_session Stripe por lo gastado   ← CANDADO
    → OK: cobro Hecom + detach PM
    → FAIL: no detach; alerta staff + link Cobrana / cobranza Hecom
```

---

## 4. Reglas de negocio a cerrar (antes de code)

| # | Pregunta | Nota |
|---|----------|------|
| A | ¿Monto al quitar tarjeta = gasto+fee pendiente Hecom, o “mínimo del ciclo”? | Default propuesto: **solo lo gastado + fee**, no el cupo entero. |
| B | ¿Bruto Holistic fee de recarga aplica aquí? | Cobro de deuda crédito ≠ depósito cartera; alinear con Hecom (prob. monto deuda CRM). |
| C | ¿Quién es “crédito”? | `credito_form_slug` en Hecom + lista/allowlist Holistic. |
| D | ¿Cupo se corta al 80–90% del límite aunque haya tarjeta? | Evita llegar a $700 y ghostear. |
| E | ¿Hold / autorización previa (manual capture) vs solo cobro al detach? | Hold reduce fraude; más fricción Stripe. |
| F | Términos legales / consentimiento off-session | Obligatorio en copy + contrato. |

---

## 5. Mapa técnico Stripe (solo referencia — no implementar)

- `Customer` por cliente Hecom / org Holistic.
- `SetupIntent` → guardar `payment_method` (`card`).
- Guardar `stripe_customer_id` + `default_payment_method_id` (Supabase Holistic).
- Al detach / “quitar tarjeta”:
  - `PaymentIntent` `confirm: true`, `off_session: true`, `customer` + `payment_method`.
  - Idempotencia: `credito-detach:{clienteId}:{deudaCents}:{day}`.
- Webhooks: `payment_intent.succeeded` / `payment_intent.payment_failed`.
- Si falla (3DS, fondos, tarjeta robada): UI no permite detach; ticket cobranza.

**Prepago / cartera:** sigue el flujo actual (bridge cobros).  
**Crédito:** este plan; no mezclar “quitar tarjeta” con simple logout.

---

## 6. Cobrana (API pública v1 — docs recibidas 2026-09-03)

Fuente: `cobrana_api_docs_es.html` (OpenAPI 3.1).

### Qué es
API para **crear y consultar órdenes de pago (charges)**.  
**Ningún dato de tarjeta pasa por esta API** (checkout hosted / código banco).

### Entornos
| | Base URL | Key |
|---|---|---|
| Cert | `https://api.cert.cobrana.pe/v1` | `sk_test_…` |
| Prod | `https://api.cobrana.pe/v1` | `sk_live_…` |

Auth: `Authorization: Bearer sk_…` · permisos `charges:read` / `charges:write`.

### Métodos de pago
| method | option | Qué recibe el deudor |
|---|---|---|
| `gateway` | `monnet` | `paymentUrl` (página Cobrana / sesión a Monnet: card o QR) |
| `services` | `360pay` \| `cobrana` | `code` + opcional `deeplinks` (Yape/BCP app) — sin página Cobrana |

Webhook clave: **`charge.paid`** (única señal confiable de pago; no confiar en que el browser vuelva, sobre todo QR).

### Reglas importantes
- Moneda: **solo PEN** hoy.
- Mínimo: **S/ 10** (puede subir si hay fee fijo del plan).
- `feeMode`: `merchant` \| `customer`.
- `POST /charges` **exige** `Idempotency-Key`.
- Customer: documento obligatorio (`documentNumber`).
- Pruebas: panel → “Marcar como pagado” dispara webhook real firmado.
- Sesiones: `POST /charges/{id}/checkout_sessions` para checkout propio (solo gateway).

### Encaje Holistic
| Caso | Quién |
|---|---|
| **Candado** crédito (tarjeta on file + cobro al quitar) | **Stripe** |
| Pagar deuda / recarga cartera en **soles** | **Cobrana** (o manual BCP) |
| Cobro off-session sin presencia del deudor | Solo Stripe (Cobrana no) |

**Frase de producto:** *Stripe = candado · Cobrana = pago en soles.*

Ver también: `docs/REUNION_COBRANA_PAUTAS.md`.

**Pendiente para integrar:** keys cert, webhook URL + secret de firma, mapeo PEN↔USD cartera, bridge cobro Hecom al `charge.paid`.

**No integrar Cobrana hasta orden + keys.**

---

## 7. Contratos / Hecom

- Ya hay trabajo de contratos (firma, etc.).
- Cláusula sugerida: *autorización a cobrar el saldo consumido del cupo crédito al revocar el medio de pago o al incumplir el ciclo*.
- Bridge Holistic→cobros ya cubre **prepago/cartera**. Crédito con tarjeta es capa aparte (deuda viva + off-session).

---

## 8. Fases sugeridas (cuando digan “empezar”)

1. **Inventario crédito:** listar clientes `credito_form_slug` + si tienen tarjeta on file hoy (casi nadie en Holistic).
2. **Spec Stripe** corta (SetupIntent + detach charge) + copy UI.
3. **MVP:** exigir tarjeta para activar cupo; cobro al “quitar tarjeta” = deuda Hecom pendiente.
4. **Tope suave:** pausar fondeo TikTok al X% del cupo.
5. **Cobrana (PEN):** recargas cartera / link de pago; no sustituye card-on-file.
6. Hardening: 3DS, reintentos, disputa, staff override.

---

## 9. Fuera de alcance ahora

- Implementar cobro al quitar tarjeta.
- Cambiar bridge prepago.
- Integrar Cobrana sin keys / orden.
- Pago manual como candado de crédito.

---

## 10. Veredicto de la idea

**Fina y alineada al riesgo real** (ghosting con cupo abierto).  
**Stripe = candado** (tarjeta on file + cobro al quitar).  
**Cobrana = pago en soles** (ciclo / abonos / recarga PEN, sin forzar comisión Stripe al que paga en soles).  
Condiciones: consentimiento claro, cobro al detach = **lo gastado**, no permitir detach si falla el cargo.  
Manual no sustituye el candado.