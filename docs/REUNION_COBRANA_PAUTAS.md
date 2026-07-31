# Reunión Cobrana — Pautas (Hecom / Holistic)

**Objetivo de la reunión:** alinear integración de Cobrana como pasarela de recargas en **soles (PEN)** y negociar comisión por volumen.

**Contexto nuestro:** plataforma multi-pasarela. **Stripe** (y manual) siguen siendo opciones. Cobrana no reemplaza nada: es **otra forma de pagar**, pensada para clientes que operan en soles.

---

## 1. Qué queremos lograr hoy

- [ ] Confirmar que Cobrana sirve para **recargas de cartera** (montos altos, frecuentes).
- [ ] Negociar comisión: **0.5%** (por volumen fuerte).
- [ ] Entender métodos: Yape / Plin / tarjeta / otros.
- [ ] Pedir **API + webhooks** (o el mecanismo que usen) para acreditar saldo automático.
- [ ] Acordar sandbox / prueba y tiempos de liquidación.
- [ ] Dejar próximo paso claro (piloto / contrato / keys).

---

## 2. Cómo lo presentamos (elevator)

> Tenemos una plataforma de ads donde el cliente recarga su cartera y gasta en publicidad.  
> Ya tenemos Stripe y pago manual. Queremos sumar **Cobrana en soles** para que clientes peruanos recarguen fácil (Yape/Plin/tarjeta), con comisión competitiva porque movemos **volúmenes altos**.  
> Stripe sigue como opción (sobre todo USD / internacional). Cobrana sería la opción natural en PEN.

---

## 3. Puntos a negociar (prioridad)

| Tema | Nuestra posición | Preguntarles |
|---|---|---|
| Comisión | **0.5%** | ¿Fijo? ¿mínimo por operación? ¿escala por volumen? |
| Moneda | Solo **PEN** en Cobrana | ¿Soportan USD? (si no, ok) |
| Métodos | Yape, Plin, tarjeta | ¿Cuáles exactos y fees distintos? |
| Liquidación | Lo más rápido posible | ¿T+0 / T+1 / semanal? |
| Montos | Recargas fuertes y repetidas | ¿Límites min/max diarios? |
| Integración | Webhook + API | ¿Docs, sandbox, firma de webhook? |
| Soporte | Canal directo | ¿WhatsApp / correo / SLA? |

**Frase para el 0.5%:**
> Movemos cantidades fuertes y recurrentes. Con 0.5% nos conviene priorizar Cobrana en soles y empujar volumen por ustedes. Si el fee es más alto, el cliente se va a Stripe/manual.

---

## 4. Qué NO negociar mal / no confundir

- Cobrana **no** sustituye Stripe. Son opciones en paralelo.
- No prometamos acreditar saldo “a mano”: queremos **confirmación automática** (webhook).
- Si la cartera interna está en USD y Cobrana cobra en soles, hay que definir **quién asume tipo de cambio** (nosotros vs cliente). Dejarlo dicho en la reunión.
- No compartir secrets / keys en el chat de la reunión; solo después por canal seguro.

---

## 5. Preguntas técnicas (si entra el tema)

1. ¿Tienen API de crear cobro / link de pago?
2. ¿Webhook cuando el pago está confirmado? ¿Qué eventos mandan?
3. ¿Cómo validamos la firma del webhook?
4. ¿Hay ambiente de prueba?
5. ¿El pago puede llevar `reference` / `metadata` (org_id, payment_intent_id)?
6. ¿Reembolsos / chargebacks cómo se manejan?
7. ¿Facturación / comprobante para el comercio?

---

## 6. Flujo que queremos (explicación simple)

```
Cliente elige Cobrana (soles)
→ paga (Yape/Plin/tarjeta)
→ Cobrana confirma (webhook)
→ nosotros acreditamos cartera
→ cliente asigna saldo a cuentas ads
```

Regla: **solo el webhook/backend acredita**. Nunca el front.

---

## 7. Guion corto de la reunión (~20–30 min)

1. **Presentación (2 min):** quiénes somos + volumen / caso de uso.  
2. **Producto (3 min):** multi-pasarela; Stripe queda; Cobrana = soles.  
3. **Negocio (10 min):** 0.5%, métodos, liquidación, límites.  
4. **Técnica (8 min):** API, webhook, sandbox, metadata.  
5. **Cierre (5 min):** próximos pasos + responsable de cada lado.

---

## 8. Cierre — qué pedir antes de irnos

- [ ] Confirmación verbal/escrita del **0.5%** (o contraoferta clara).  
- [ ] Link a docs API / contacto técnico.  
- [ ] Acceso sandbox o fecha de entrega.  
- [ ] Condiciones de liquidación.  
- [ ] Fecha de follow-up (piloto).

**Próximo paso interno (después de la reu):**  
integrar provider `cobrana` + webhook → ledger (igual que Stripe), y dejar Stripe/manual intactos.

---

## 9. Mensaje WhatsApp post-reu (plantilla)

> Gracias por la reunión. Resumen: Cobrana como opción de recarga en **soles**, Stripe sigue en paralelo. Quedamos en comisión **X%**, métodos ___, liquidación ___, y nos pasan docs/API + sandbox para el piloto. Seguimos esta semana.
