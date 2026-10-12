# Handoff — Sistema para clientes que no pagan, nos bloquean o desaparecen

> Para el agente que siga esta conversación. Español Perú, tono directo, respuestas cortas.
> Estado al 12/10/2026: **solo idea + herramientas sueltas que ya existen. El sistema no está construido.**
> Antes de tocar plata, leé `docs/PLAYBOOK_FRENAR_GASTO_CLIENTE.md` y las reglas de la sección 6.

## 1. El problema

Hoy cada caso se resuelve a mano y tarde: alguien avisa por WhatsApp, se revisa Hecom, se congela al cliente con un script y se le escribe. Mientras tanto el cliente sigue gastando el crédito (BM10/30) o el cash que ya tiene en TikTok. Casos que motivan esto:

- **Prepago con deuda de setiembre (sin pagar a 12/10):** Renzo Cruz $769.96, Neojael Justo $394.77, Jesus Fuentes $290.53, Wilder Remolina $148.37 (este ya congelado y con su saldo de octubre aplicado a setiembre).
- **Congelados por orden de gerencia (motivo no registrado):** Levi Aguirre, Jesús Jiménez, Josué Luna, Dam Aguirre. Ver memorias `*-congelado`.
- **Levi**: estando congelado, alguien le subió el presupuesto a mano en TikTok BC (5775 → 7775) y gastó $157 sin pagar. TikTok **no registra quién** cambia presupuestos.
- **Clientes que bloquean/desaparecen:** hay un cliente en Hecom llamado "Federico Borsalino (NOS BLOQUEO)". Saldo atrapado en cuentas castigadas (Dam ~$1,358, Levi ~$889) que TikTok no deja devolver.
- La alerta automática de prepago (`PREPAGO_GUARD_MODE`) está en **modo alerta** desde el 02/10: detecta pero no corrige.

## 2. Lo que ya existe (reusar, no rehacer)

| Herramienta | Qué hace |
|---|---|
| `scripts/_congelar-cliente.mjs <advs> [--commit]` | Pausa campañas, cupo BM10/30 = gastado, REFUND del cash BM200/300 (deja el máximo que TikTok permite). |
| `scripts/_pasar-favor-a-mes.mjs <cliente> <desde> <hacia> <monto>` | Aplica saldo a favor de un mes a la deuda de otro (mueve cobros en Hecom, respeta recargo de pasarela). |
| `scripts/_reporte-saldo-favor.mjs`, `scripts/_prepago-deuda.mjs` | Quién tiene a favor / quién debe, cruzado con lo que puede gastar hoy en TikTok. |
| Link de deuda `/p/lo-pagado/<token>` | El cliente ve su estado de cuenta y paga la deuda **por voucher o con tarjeta (Whop)**; abona al mes de la deuda, no a la cartera. |
| `lib/payments/prepago-guard.server.ts` (cron 15 min) | Detecta cupo/cash sin pago detrás. Tiene modo `enforce` con freno de 10 cuentas por corrida. |
| `/apelaciones` + `tiktok_account_appeals` | Apelaciones de cuentas castigadas (solo staff). |
| Auto-mapeo de cuentas (cron horario `/api/jobs/tiktok/map-accounts`) | Toda cuenta queda vinculada a su cliente: sin esto no se puede congelar todo. |
| Panel "Solo gerencia" en Cuentas Ads | Crear cuentas con vínculo inmediato (evita cuentas huérfanas). |

## 3. Propuesta: estados de cobranza por cliente

Un estado por cliente, calculado cada día desde Hecom (deuda por mes con `credito-resumen-totales-core`) y guardado con historial:

| Estado | Regla sugerida (a validar con gerencia) | Acción automática |
|---|---|---|
| **Al día** | Sin deuda de meses cerrados. | Nada. |
| **Aviso** | Deuda de mes cerrado ≤ 5 días. | Banner en su panel + link de deuda + WhatsApp/email recordatorio. |
| **Mora** | Deuda > 5 días o > $X. | Banner rojo; **no puede asignar saldo ni crear cuentas**; cupo BM10/30 no sube. |
| **Congelado** | Deuda > 10 días, o orden de gerencia. | `_congelar-cliente` automático (pausa + cupo a gastado + REFUND), motivo y quién obligatorio. |
| **Cobranza** | Deuda > 30 días o nos bloqueó. | Expediente (sección 4), carta, sin servicio. |
| **Castigo / incobrable** | Gerencia lo decide. | Se registra la pérdida; queda en lista negra para no volver a darle crédito. |

Piezas a construir:
1. Tabla `cliente_cobranza_estado` (+ historial): estado, deuda, desde cuándo, motivo, quién lo puso, si es manual.
2. Cron diario que recalcule y **suba** de estado solo; bajar de estado solo cuando paga (o gerencia).
3. **Guardián de congelados**: cada 15 min revisa que los congelados sigan en cupo = gastado y cash 0; si alguien les subió presupuesto a mano en TikTok, lo vuelve a bajar y avisa (caso Levi).
4. Aviso al cliente: banner en el panel y en Pagos con monto en vivo y botón al link de deuda (ya propuesto, ver conversación de Wilder). Recordatorios por WhatsApp/email en días 1, 3, 5.
5. Bandeja de gerencia "Cobranza": lista por estado, deuda, días, último contacto, botón congelar/descongelar con motivo.
6. Re-evaluar pasar `PREPAGO_GUARD_MODE` a `enforce` (decisión pendiente de gerencia).

## 4. Expediente para cobrar (cuando no paga o nos bloquea)

Armado automático en PDF por cliente:
- Datos: nombre, DNI/RUC (Hecom `clientes.dni`), teléfonos, correos, contrato firmado si hay (`client_service_contracts`, `alliance_contracts`).
- Estado de cuenta mes a mes (gasto + fee, pagos, garantías, deuda) — igual que el link de deuda.
- Gasto por día y por cuenta TikTok (API `report/integrated/get`) como prueba de consumo.
- Historial de avisos enviados y respuestas (WhatsApp/email), con fechas.

Pasos legales en Perú (**validar con abogado antes de usar; no es asesoría legal**): carta de requerimiento → carta notarial → conciliación extrajudicial → demanda de obligación de dar suma de dinero (proceso único de ejecución si hay título, p. ej. letra/pagaré firmado). Reportar a centrales de riesgo exige base legal y aviso previo: confirmarlo antes.

## 5. Prevención (lo más barato)

- Contrato/términos aceptados con DNI antes de dar crédito; idealmente pagaré o garantía.
- Crédito solo después de N meses al día; tope de crédito por cliente.
- Prepago por defecto para nuevos; BM10/30 nacen con cupo $0 (ya se hace al crear desde el panel de gerencia).
- Quitar permisos de "Finanzas" en TikTok BC a quien no deba mover presupuestos (TikTok no deja auditar quién lo hizo).

## 6. Reglas que no se rompen

- Nunca imprimir `TIKTOK_ACCESS_TOKEN` ni service role keys. Nunca `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Mover plata o cupo: primero dry-run, después `--commit` solo con orden explícita de gerencia.
- No tocar clientes "paga después" (Ely Aguirre, Adriana Trujillo) sin orden.
- Nunca dar al cliente acceso de admin del BM: solo ADMIN de su cuenta.
- Congelar siempre con motivo y quién lo ordenó (hoy no se registra, y después nadie sabe por qué).

## 7. Preguntas abiertas para gerencia

1. Días y montos de cada estado (¿5/10/30 días? ¿monto mínimo?).
2. ¿El congelamiento automático aplica a todos o solo a prepago?
3. ¿Se activa `enforce` del guardián de prepago?
4. ¿Hay contrato firmado con los clientes de crédito? ¿Pagaré?
5. Motivo de los congelamientos de Levi, Jesús, Josué y Dam, para registrarlo.
