# Auditoría Proyectovv ↔ Hecom Club

**Fecha:** 2026-09-16 · **Estado:** hallazgos listos, **nada corregido todavía**
(esperando go de Victor).

Correr de nuevo en cualquier momento (solo lectura, no escribe nada):

```bash
node scripts/audit-hecom-proyectovv.mjs
```

---

## 0. Cómo se conectan los dos sistemas

| Qué | Dónde vive | Detalle |
|-----|-----------|---------|
| Pagos / cartera / ledger | **Proyectovv** | `payment_intents`, `ad_accounts`, `wallets` |
| Fichas, cobros, gastos, garantías | **Hecom Club** | `clientes`, `cobros`, `gastos`, `garantias` |
| Puente de cobros | endpoint Hecom | `POST /api/credito-cobros-holistic-wallet` |
| Cuentas TikTok por cliente | Hecom | `cliente_tiktok_cuentas` |

Proyectovv escribe en Hecom por dos vías: el endpoint del puente (cobros) y la
service role directa (`lib/hecom/*`, para fichas y mapeos de cuentas).

Idempotencia de cobros: `codigo` = `AH-{STRIPE|BCP|YAPE|CRYPTO}-{payment_intent_id}`.

---

## 1. Hallazgos — lado Hecom (para el otro equipo)

### 1.1 🔴 ALTA · Falta `UNIQUE` en `cobros.codigo` → cobro duplicado real

El `codigo` es la llave anti-doble-cobro, pero **no tiene índice único**, así que
dos llamadas simultáneas insertan dos filas en vez de una.

Ya pasó, con plata de una clienta real:

| Cliente | Código | Filas | Registrado | Pago real |
|---------|--------|-------|-----------|-----------|
| Catherine Burgos | `AH-STRIPE-b8422a3d-4177-40fa-a870-4e99adb2026f` | 2 | **$220** | $110 |

Las dos filas se crearon con **77 ms de diferencia** (`18:36:44.718` y
`18:36:44.795`), las dos automáticas. El chequeo de idempotencia del endpoint es
un `SELECT` seguido de un `INSERT`, así que las dos llamadas pasaron el chequeo
antes de que cualquiera insertara.

Proyectovv llama al puente dos veces a propósito para el mismo pago (ganador y
perdedor del claim, ver `create-intent.server.ts`), justamente confiando en que
el endpoint es idempotente. Esa suposición hoy no se cumple.

**Pedido concreto:**

1. `CREATE UNIQUE INDEX ... ON cobros (codigo)` — o `UPSERT ... ON CONFLICT (codigo)`.
2. Borrar la fila duplicada de Catherine (`23bfd7da-3170-44be-8501-a8af42b17406`
   o `7a4af39f-21b0-4590-9ee8-594d27b1fdea`, da igual cuál, son idénticas).
3. Confirmar que ante conflicto el endpoint responde `ok: true, idempotent: true`
   y no un error, porque si responde error nuestro lado lo marca como fallido y
   lo reintenta.

### 1.2 🟡 MEDIA · `periodo_resumen` lo decide la deuda, no la fecha de pago

El endpoint imputa el cobro **al período más viejo que el cliente no tiene
cubierto**, e ignora cualquier período que le mandemos. Un pago del 12/09 de un
cliente con deuda de mayo quedaba archivado en `2026-05`, y como el CRM filtra
por período y no por fecha de pago, **el pago parecía no haberse registrado**.

Verificado el 16/09 con el mismo `paid_at` y distintos clientes:

| Cliente | Período que asignó |
|---------|--------------------|
| Jan Alex | 2026-09 |
| Neojael Justo | 2026-06 |
| Roberto Misajel | 2026-08 |
| Catherine Burgos | 2026-09 |

**Gerencia definió que el cobro debe vivir en el mes en que se pagó.** Mientras
tanto lo parchamos del lado de Proyectovv (`alignCobroPeriodoToPaymentMonth`
reescribe `periodo_resumen` después de crear el cobro).

**Pedido:** mover la regla al endpoint (`periodo_resumen` = mes de `paid_at`) o
aceptar un `periodo_resumen` explícito en el payload. Cuando esté, apagamos
nuestro parche con `HECOM_COBRO_PERIODO_ALIGN=false` y borramos el código.

Ojo con el efecto: sacar el pago del mes de deuda deja ese mes pendiente otra
vez. Ver `MANUAL_BANK_DUAL_PROOF.md` para los 3 casos concretos.

### 1.3 🔴 ALTA · Fichas duplicadas

| DNI | Fichas | Nota |
|-----|--------|------|
| 71012732 | `Arnold Cilloniz` (9502038c) · `Arnold Cilloniz` (8e2c8278) | **a unificar** |
| 75014958 | `[DUP] Piero Acasiete García` (0b45827e) · `Piero Alexander Acasiete García` (0bd95ba9) | ya resuelto, el `[DUP]` está neutralizado |

Y dos emails de login en dos fichas cada uno:

| Email | Fichas |
|-------|--------|
| `fcarimo.alexander@gmail.com` | `Frank Cari` · `Frank Cari - Mexico` |
| `notcount9001@gmail.com` | `Fabian Hoyos - Ecuador` · `Fabian Hoyos - Colombia` |

Estos dos últimos parecen a propósito (misma persona, país distinto), pero al
entrar a la plataforma el email resuelve a una ficha ambigua. **Hay que definir
cuál es la de login.** El caso Piero ya nos mostró el costo: cobros y cuentas
repartidos entre dos fichas.

### 1.4 🟡 MEDIA · 16 fichas sin ningún email

No pueden entrar a la plataforma: el login busca por email en `clientes.emails`.
Si se espera que entren, hay que cargarlo.

Aparte, **155 de 188 fichas tienen DNI placeholder `CL-*`** en vez de DNI real.
No rompe nada hoy, pero inutiliza el DNI como llave para detectar duplicados —
por eso los duplicados de arriba sólo se ven en 2 casos.

---

## 2. Hallazgos — lado Proyectovv (los tomo yo)

### 2.1 🔴 ALTA · 9 pagos acreditados sin cobro en Hecom

| Origen | Pagos | Monto | Con ficha |
|--------|-------|-------|-----------|
| `manual/dashboard` | 10 | $966.84 | 6 |
| `manual/recharge_chat_bot` | 2 | $47.87 | 2 |
| `manual/-` | 1 | $0.03 | 1 |
| `manual/agency_bm_bridge` | 9 | $234.00 | 0 |

Los 9 con ficha son secuela del bug arreglado el 16/09 (los auto-abonos de Yape
y banco manual no llamaban al puente, commit `af50607`). Son montos de prueba
del equipo (Sebas, Jair): $3.20 y $0.03. **Victor decidió no curarlos** para no
ensuciar el CRM.

Curar si cambia de idea: `node scripts/backfill-hecom-wallet-cobros.mjs --dry-run`.

### 2.2 🟡 MEDIA · 13 pagos sin `hecom_cliente_id`

9 son de `agency_bm_bridge` (otra función, sin cliente asociado) y 4 son de julio,
de antes de que existiera el puente ($900 en total). No se pueden puentear
automáticamente: hay que decidir a qué ficha van o si son internos.

### 2.3 🔴 ALTA · 6 cuentas ads duplicadas en el panel de un cliente

Todas de **Jhoseph/Joseph Carranza**, en `Mi organización`: dos filas en
`ad_accounts` para el mismo advertiser. Las ve duplicadas en su panel y el saldo
se reparte entre las dos filas.

`7675785324939952146` · `7675780493450674194` · `7675785652092420114` ·
`7675784484939251720` · `7675780026984546322` · `7675779427309092884`

### 2.4 🟡 MEDIA · 6 fichas con principal fuera de sus mapeos

`clientes.tiktok_advertiser_id` apunta a una cuenta que no está en sus
`cliente_tiktok_cuentas`: Josue Luna, Frank Cari, Brian Rodríguez, Dominic
velame, Steve Maldonado, Holistic.

Importa por lo que aprendimos liberando la cuenta de Alexandra:
`resolveHecomAccounts` cae a ese campo cuando el cliente no tiene mapeos, así que
un principal desalineado puede mostrar u ocultar una cuenta que no corresponde.

### 2.5 🔵 BAJA · 936 `ad_accounts` de orgs borradas

Restos de importaciones de julio repartidos en 8 orgs que ya no existen. De 80
revisadas, 1 con saldo y 0 con gasto. No se ven en ningún panel; sólo ensucian
las consultas por advertiser (fue lo que me hizo ver "194 duplicados" cuando los
reales son 6).

---

## 3. Qué necesito del otro lado para cerrar

1. **`UNIQUE` en `cobros.codigo`** + borrar la fila duplicada de Catherine. Es lo
   más urgente: sin eso, cualquier pago puede volver a cargarse doble.
2. **Confirmar el comportamiento ante conflicto**: `ok: true, idempotent: true`.
3. **Decisión sobre `periodo_resumen`**: ¿lo mueven al endpoint o seguimos con
   nuestro parche?
4. **Unificar `Arnold Cilloniz`** y definir la ficha de login de Frank Cari y
   Fabian Hoyos.
5. **Confirmar si las 16 fichas sin email** deben poder entrar a la plataforma.

## 4. Lo que hago yo cuando llegue el go

1. Dejar una sola fila por cuenta en las 6 de Carranza (revisando antes cuál
   tiene el saldo).
2. Alinear los 6 principales desalineados con sus mapeos.
3. Limpiar o marcar las 936 filas de orgs borradas.
4. Decidir con Victor los 13 pagos sin ficha.

---

## 5. Lo ya corregido el 16/09 (contexto)

| Commit | Qué |
|--------|-----|
| `af50607` | Los auto-abonos de Yape y banco manual ahora registran el cobro |
| `5df787d` | El cobro se archiva en el mes en que se pagó + backfill de 9 |
| `b7f91fc` | Liberar cuenta ads también limpia `clientes.tiktok_advertiser_id` |

Scripts disponibles:

| Script | Para qué |
|--------|----------|
| `audit-hecom-proyectovv.mjs` | Esta auditoría (solo lectura) |
| `backfill-hecom-wallet-cobros.mjs` | Curar pagos sin cobro (4 canales) |
| `realign-hecom-cobro-periodos.mjs` | Re-archivar cobros a su mes de pago |
