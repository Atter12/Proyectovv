# Recarga en soles con validación automática

Automatiza el pago manual en PEN que hoy revisa soporte a mano. El cliente
yapea, sube su comprobante, y el saldo entra solo cuando el cobro se confirma
contra la cuenta que lo recibe.

No es un método de pago nuevo: es el mismo **Pago manual** que el cliente ya
conoce, validado sin intervención humana. Cuando el sistema no puede confirmar,
cae en la cola de revisión de siempre.

---

## 1. Por qué existe

La auto-aprobación anterior pedía cinco condiciones:

```
analysis.confirmed          la IA dice que la captura se ve bien
&& !duplicateHash           la imagen no se reusó
&& !duplicateOperationCode  el N° de operación no se reusó
&& rateLimits.allowed       el cliente no subió demasiadas por hora
&& montoBajoTope
```

**Las cinco leen la captura que manda el cliente. Ninguna comprueba que la plata
haya llegado.** Una captura se falsifica en minutos, y ya pasó: hay un depósito
revertido en producción con `reversal_reason = fake_voucher_auto_approve_incident`.

Este trabajo agrega la condición que faltaba: **que el cobro exista en la cuenta
receptora.**

---

## 2. Cómo se identifica un pago

El identificador natural sería el N° de operación, pero **el canal de avisos no
lo trae**. Verificado contra correos reales del BCP: informan monto, remitente y
fecha, nada más. La notificación push de Android tampoco.

Entonces el identificador es **el monto exacto**, con céntimos únicos:

```
Cliente A pide $10  →  paga S/ 38.28
Cliente B pide $10  →  paga S/ 38.29   ← un céntimo distinto
```

Cuando llega *"Recibiste un yapeo de S/ 38.29"*, no hay ambigüedad posible. Sin
OCR, sin comparar nombres, sin depender del banco.

Cuesta hasta S/ 0.99 al cliente y el crédito no cambia. Se apaga con
`YAPE_UNIQUE_PEN_CENTS=false` si algún día el canal empieza a traer la
operación.

---

## 3. El flujo

```txt
Cliente escribe "quiero recargar" en el chat de soporte
  → el bot pregunta el monto en dólares
  → buildManualDepositQuote() calcula fee 10% y tipo de cambio
  → reserveUniquePenAmount() ajusta los céntimos
  → payment_intents (provider=manual, currency=PEN)
  → el bot responde con QR, monto exacto y desglose

Cliente yapea y sube la captura en el mismo chat
  → /api/payments/intents/[id]/proof
  → la IA analiza el comprobante
  → NO acredita: falta la confirmación del banco

El correo del banco llega
  → poll-mailbox lo lee (cron cada 2 min, o a demanda mientras el cliente espera)
  → classifyDirection() descarta lo que no sea un cobro recibido
  → el matcher cruza por monto exacto dentro de la ventana
  → completeBankConfirmedDeposit()
  → ledger_confirm_deposit()  →  saldo acreditado
```

Los dos órdenes funcionan. Si el aviso llega antes que el comprobante, espera; lo
cierra el comprobante cuando llega. **El comprobante es obligatorio en ambos.**

---

## 4. Qué puede salir mal, y qué hace

| Situación | Resultado |
|---|---|
| Comprobante ok + cobro confirmado + monto coincide | **Acredita** |
| Comprobante falsificado, plata nunca llegó | No acredita · revisión manual |
| Aviso de plata que **salió** de la cuenta | Descartado con motivo |
| Comprobante o N° de operación reusado | Bloqueado |
| Mismo aviso reportado dos veces | Deduplicado |
| Aviso anterior a la recarga que dice pagar | Rechazado |
| Dos recargas con el mismo monto | No adivina · revisión manual |
| Monto por debajo del umbral del banco | Se rechaza al crear la recarga |
| El agente o el correo fallan | Nada se acredita solo |

**La propiedad que se sostiene:** nunca acredita sin prueba de que el dinero
entró. Ante cualquier duda no hace nada y lo deja a una persona.

### Las tres capas contra el doble abono

1. `yape_inbound_notifications.fingerprint` — único
2. `yape_inbound_notifications.operation_number` — único cuando existe
3. `payment_intents (provider, provider_reference)` — único, ya existía

Cada una alcanza por sí sola.

### El aviso de plata saliente

El BCP manda dos correos casi idénticos, mismo remitente y mismo monto:

```
Recibido: "Constancia de recepción de Yapeo" · "Recibiste un yapeo" · "Monto recibido"
Enviado : "Constancia de Yapeo a Celular"    · "Realizaste un yapeo" · "Monto enviado"
```

`classifyDirection()` exige una marca de recepción y rechaza cualquier marca de
salida. Ante un texto ambiguo, no acredita.

---

## 5. Moneda

`v_wallet_ledger_balances` suma céntimos **sin filtrar por moneda**, así que un
asiento en PEN sobre una cartera en USD mezclaría soles con dólares en el mismo
saldo.

Por eso: **el cliente paga soles, la cartera acredita dólares.**
`payment_intents.amount_cents` guarda el bruto en soles y
`metadata.credit_amount_cents` el neto en dólares, que es lo que el ledger
acredita. El tipo de cambio (`HOLISTIC_USD_PEN_RATE`) se congela al crear la
recarga.

Ejemplo con TC 3.48 y fee 10%:

```
Cliente quiere $10 en cartera
  → neto en soles  = 10 × 3.48        = S/ 34.80
  → fee 10%                            = S/  3.48
  → paga                               = S/ 38.28
  → cartera recibe                     = $10.00
```

---

## 6. El umbral del banco

El BCP solo notifica por montos **mayores a S/ 10** (configurable en la app del
banco). Una recarga por debajo entra a la cuenta pero no genera aviso, así que
no habría forma de verificarla y quedaría colgada esperando un correo que no
existe.

Por eso se rechaza **al crearla**, con el mínimo sugerido en dólares. Con TC 3.48
y fee 10%, el mínimo real ronda los **$3**.

---

## 7. Configuración

```env
# Cuenta que recibe (se le muestra al cliente, con QR opcional)
MANUAL_PAYMENT_BANK_ACCOUNTS=[{"id":"yape-pen","label":"Yape","holder":"...","accountNumber":"9XXXXXXXX","currencies":["PEN"],"qrImageUrl":"/yape-qr.jpg"}]

# Casilla donde llegan los avisos del banco
YAPE_MAIL_USER=avisos@tudominio.com
YAPE_MAIL_PASSWORD=            # contraseña de APLICACIÓN, no la de la cuenta
YAPE_MAIL_HOST=imap.gmail.com
YAPE_MAIL_PORT=993
YAPE_MAIL_MAILBOX=INBOX
YAPE_MAIL_FROM_FILTER=notificacionesbcp.com.pe
YAPE_MAIL_LOOKBACK_MIN=30      # debe superar holgadamente el intervalo del cron

# Reglas
YAPE_REQUIRE_BANK_CONFIRMATION=true   # apagarlo revive el agujero del comprobante falso
YAPE_UNIQUE_PEN_CENTS=true            # imprescindible mientras el aviso no traiga N° de operación
YAPE_MIN_NOTIFIABLE_PEN=10            # umbral de notificación del banco
YAPE_MATCH_WINDOW_MINUTES=180

# Análisis del comprobante
OPENAI_API_KEY=                # sin esto nada se auto-aprueba
```

Cambiar de cuenta Yape es cambiar estas variables. No hay nada hardcodeado.

### Migraciones

```txt
023_yape_inbound_notifications.sql   tabla de cobros observados
024_last_deposit_from_ledger.sql     "última recarga" desde el ledger
```

---

## 8. Operación

**El cron** `/api/jobs/yape-mailbox` corre cada 2 minutos (`vercel.json`) y lee
la casilla. No guarda un cursor: mira los últimos `YAPE_MAIL_LOOKBACK_MIN`
minutos y la deduplicación descarta lo procesado. Sin cursor no hay estado que
se corrompa y saltee correos en silencio.

**A demanda:** mientras un cliente espera su recarga, su propia consulta hace que
el servidor abra la casilla, con un throttle de 12 segundos. La validación tarda
segundos en vez de esperar al cron. El cron queda como red por si cierra el
navegador.

> **Los preview de Vercel no ejecutan crons.** En una rama solo funciona el
> camino a demanda, que igual es el que usa el cliente real.

### Diagnóstico

```bash
node --env-file=.env.local scripts/yape-agent/email-agent.mjs --inspect 40
```

Muestra qué lee de la casilla y qué extrae de cada correo, sin reportar ni
acreditar. Es la herramienta para cuando un pago no cruza.

```bash
node --env-file=.env.local scripts/yape-agent/simulate-bcp-email.mjs 38.28
```

Simula el correo del BCP con su formato real. Sirve para probar y demostrar sin
mover plata.

### Cobros que no cruzan

```sql
select received_at, amount_cents, sender_name, status, match_note
from yape_inbound_notifications
where status in ('unmatched', 'ignored')
order by received_at desc;
```

**Pendiente:** no hay vista de admin para esta tabla. El intent del cliente sí
aparece en la cola de revisión manual, así que ningún cliente queda sin
atención, pero un cobro que llegó y no cruzó con nada solo se ve por SQL.

---

## 9. Riesgos conocidos

- **`YAPE_INGEST_SECRET` es una llave maestra.** Quien lo tenga puede simular
  avisos y hacerse acreditar saldo. Tratarlo como una clave de pasarela.
- **Recibir ingresos de negocio en una cuenta P2P** tiene implicancias de
  facturación y SUNAT. Es decisión del negocio, no del sistema.
- **Límites de Yape por operación** (S/ 500–1500 según banco). De ahí
  `YAPE_MAX_AMOUNT_PEN`.
- **El throttle del chequeo a demanda vive en memoria del proceso**, así que con
  varias instancias el límite es por instancia y no global. Alcanza para el
  volumen actual.
- **El push de Android no existe en iPhone.** iOS no deja que una app lea las
  notificaciones de otra. Con iPhone el único camino es el correo.
