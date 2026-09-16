# Auditoría Proyectovv ↔ Hecom Club

**Fecha:** 2026-09-16 · **Foco:** cobros de clientes (prioridad de gerencia).

Correr de nuevo en cualquier momento (solo lectura, no escriben nada):

```bash
node scripts/audit-cobros-conciliacion.mjs   # plata contra plata, pago por pago
node scripts/audit-hecom-proyectovv.mjs      # resto del borde (fichas, cuentas)
```

## Estado de los cobros al 16/09

| | |
|---|---|
| Pagos de cliente a conciliar | **93** |
| Con su cobro correcto en Hecom | **80** |
| Con monto / cliente / fecha mal | **0** |
| Sin cobro | 13, todos explicados abajo |
| Clientes que cuadran | **17 de 19** |
| Total | app $11,880.72 · Hecom $11,847.29 · diferencia **$33.43** |

Esos $33.43 son pruebas del equipo (Sebas $33.40 · Jair $0.03). **De plata de
clientes reales no falta ni sobra nada.**

Corregido hoy: el doble cobro de $110 a Catherine Burgos (ver 1.1).

Pendiente de definir entre los dos equipos: **con qué mes se archiva un cobro**
(ver 1.2). Es lo único que queda abierto y afecta lo que el CRM muestra por mes.

### ¿Se arregló el caso "pagó en setiembre y salía en agosto"?

Sí, y está verificado para todos, no solo para Jan Alex:

- Los **79 cobros automáticos** están en su mes de pago. Ninguno desalineado.
- Los nuevos se alinean solos (`alignCobroPeriodoToPaymentMonth`), así que no
  vuelve a pasar sin que nadie haga nada.
- **Jan Alex**: su pago de $110 del 12/09 está en `2026-09`. Setiembre le muestra
  $210 cobrados sobre $315.95 de deuda. Antes mostraba $100 y se le habría
  pedido $215.95 teniendo ya $110 pagados — eso era el cobro de más.
- Reconstruí el estado mes a mes de los 188 clientes antes y después del cambio:
  **no creó ningún caso nuevo** de "mes pendiente que ya estaba pagado" (9 antes,
  9 después) y mejoró uno. Detalle en `MANUAL_BANK_DUAL_PROOF.md`.

Pero buscando eso aparecieron **otras tres cosas que sí hacen aparecer deuda que
ya se pagó**, y ninguna viene de la integración: ver 1.6, 1.7 y 1.8.

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

### 1.1 🔴 ALTA · Falta `UNIQUE` en `cobros.codigo` → hubo un cobro duplicado

> **Fila duplicada ya borrada el 16/09** (`7a4af39f`, quedó `23bfd7da`).
> Catherine quedó con 19 cobros en setiembre por $3,794.45, el de $110 una sola
> vez. **Falta el índice único**, así que puede volver a pasar.

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
2. Confirmar que ante conflicto el endpoint responde `ok: true, idempotent: true`
   y no un error, porque si responde error nuestro lado lo marca como fallido y
   lo reintenta.

Mientras no exista el índice, el chequeo queda en la auditoría:
`audit-cobros-conciliacion.mjs` sección 1 los detecta, y con
`--fix-duplicados` borra las filas de más (solo toca `AH-*`).

### 1.2 🔴 ALTA · Hoy convivimos con dos reglas de período distintas

Esto es lo que hay que cerrar en la auditoría conjunta, porque es lo que hace que
un pago "no aparezca" en el CRM.

| Tipo de cobro | Cuántos | Regla que sigue hoy |
|---------------|---------|---------------------|
| Automáticos `AH-*` | 79 | **mes en que se pagó** (lo que pidió gerencia, aplicado el 16/09) |
| Cargados a mano | 1060 | **449 están en un mes distinto al del pago** |
| Sin `periodo_resumen` | 145 | no salen en ninguna vista filtrada por mes |

Los 449 manuales mueven **$1,109,520** y el patrón es casi siempre el mismo:
el período es **el mes anterior** al de la fecha de pago.

| Salto | Cobros |
|-------|--------|
| 2026-04 ← pagado en 05 | 92 |
| 2026-06 ← pagado en 07 | 66 |
| 2026-05 ← pagado en 06 | 60 |
| 2026-07 ← pagado en 08 | 56 |
| 2026-03 ← pagado en 04 | 46 |
| 2026-08 ← pagado en 09 | 42 |

Clientes más afectados: Ely Aguirre (32), Hernan Lora (30), Jerson Artezano (27),
Yim Villar (22), Josue Luna (19).

Eso tiene sentido si el período significa **"el mes que este pago cubre"** (pagan
en mayo el servicio de abril). Pero gerencia definió para los automáticos que
significa **"el mes en que entró la plata"**. Las dos lecturas no pueden convivir:
hoy los 79 automáticos dicen una cosa y 449 manuales dicen la otra.

**Hay que decidir una sola:**

- **Mes en que entró la plata** → hay que re-archivar los 449 manuales
  ($1.1M cambiando de mes). El script `realign-hecom-cobro-periodos.mjs` hoy solo
  toca `AH-*` a propósito; habría que autorizar que toque los manuales.
- **Mes que el pago cubre** → hay que revertir lo nuestro
  (`HECOM_COBRO_PERIODO_ALIGN=false`) y el CRM debería mostrar la fecha de pago
  al lado del período, que era el problema original de Jan Alex.

**No toqué ni un cobro manual.** Son del equipo y mover $1.1M entre meses es
decisión de gerencia, no mía. Victor lo dejó para resolverlo en la auditoría
conjunta (16/09), así que hasta entonces los 449 quedan como están.

Aparte, los **145 cobros sin `periodo_resumen`** quedan invisibles en cualquier
vista por mes. Eso sí hay que rellenarlo con cualquiera de las dos reglas.

### 1.3 🟡 MEDIA · Origen del problema: el endpoint elige el período por deuda

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

### 1.4 🔴 ALTA · Fichas duplicadas

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

### 1.6 🔴 ALTA · 142 cobros viejos no están atados al cliente ($129,917)

Hasta junio de 2026 el cobro se ataba al **gasto** (`cobros.gasto_id`) y no al
cliente: esas 142 filas tienen `client_id = null` y `periodo_resumen = null`.

Son pagos reales de **23 clientes**. Se pueden atribuir sin ambigüedad siguiendo
`gasto_id → gastos.client_id`, y el mes sale de `gastos.mes`.

Si el CRM lee lo cobrado por `client_id`, **esos 23 clientes muestran
$129,917.66 más de deuda de la que tienen**. Al contarlos, la deuda global baja
de $372,777 a $242,860:

| Cliente | Deuda que muestra si no se cuentan | Deuda real |
|---------|-----------------------------------|-----------|
| Alexis Ancalle | $17,109.31 | **$0** (sus cobros viejos son $17,110.28) |
| Ely Aguirre | $65,731.42 | $25,352.96 |
| Jerson Artezano | $48,309.76 | $9,528.40 |
| Cainan Aguirre | $10,074.44 | $0 |
| Yim Villar | $8,003.29 | $0 |
| Renzo Cruz | $6,547.50 | $0 |
| Dam Aguirre | $10,188.73 | $6,173.77 |

**Lo primero que hay que confirmar del lado de Hecom: ¿el CRM los cuenta o no?**
Si la ficha del cliente los muestra, no hay nada que hacer. Si no, hay que
rellenarles `client_id` y `periodo_resumen` desde el gasto — y mientras eso no
pase, no se le puede reclamar deuda a ninguno de esos 23.

### 1.7 🔴 ALTA · Dos cobros archivados en un mes que todavía no llegó

Un período futuro es siempre un tipeo, y deja el mes real pendiente:

| Cliente | Monto | Pagado | Período | Debería ser |
|---------|-------|--------|---------|-------------|
| Daniel Hurtado | $1,345.86 | 2026-01-07 | `2026-12` | `2025-12` |
| Yolmer Eugenio | $100.00 | 2026-09-07 | `2026-10` | `2026-09` |

El de Daniel Hurtado se confirma solo: su único mes pendiente es `2025-12` por
**exactamente $1,345.86**. Está cobrando de más por un dígito.

Los dos son cobros manuales (`C-*`), así que no los toqué.

### 1.8 🟡 MEDIA · 10 clientes con un mes pendiente que ya pagaron

Son $636.55 en total y vienen del reparto de los cobros manuales entre meses, no
de la integración. El más grande es **Patrick Oddar**: muestra $353.55 pendientes
en `2026-09` teniendo $423.30 a favor en `2026-08`.

El patrón típico es el cliente que paga adelantado: la plata queda en el mes en
que pagó y el mes del gasto figura pendiente. Con la regla "mes en que entró la
plata" esto va a pasar siempre, así que **para decidir si a alguien se le
reclama hay que mirar el neto ("Todos"), no el mes suelto.**

Lista completa: `node scripts/audit-hecom-saldos.mjs`, sección 2.

### 1.9 🟡 MEDIA · 16 fichas sin ningún email

No pueden entrar a la plataforma: el login busca por email en `clientes.emails`.
Si se espera que entren, hay que cargarlo.

Aparte, **155 de 188 fichas tienen DNI placeholder `CL-*`** en vez de DNI real.
No rompe nada hoy, pero inutiliza el DNI como llave para detectar duplicados —
por eso los duplicados de arriba sólo se ven en 2 casos.

---

## 2. Hallazgos — lado Proyectovv (los tomo yo)

### 2.1 🟢 Los 13 pagos sin cobro: ninguno es plata de cliente perdida

| Caso | Pagos | Monto | Qué son |
|------|-------|-------|---------|
| Pruebas de Sebas | 8 | $33.40 | ficha de test: 0 cobros, 0 gastos, 0 cuentas. Montos de $3.20 y $11 |
| Prueba de Jair | 1 | $0.03 | 3 centavos del testeo del 10/09 |
| Julio, de orgs borradas | 4 | $900.00 | anteriores al puente, sin `hecom_cliente_id` |

Los 9 de prueba son secuela del bug arreglado hoy (los auto-abonos de Yape y
banco manual no llamaban al puente, commit `af50607`). **Se dejan sin curar a
propósito** para no ensuciar el CRM con centavos de testeo.

Los 4 de julio ($100, $200, $100, $500) salieron de organizaciones que ya no
existen, así que no se puede saber de qué ficha eran. Los tres tienen un cobro
manual de soporte del mismo monto y fecha (ej. el de $500 del 09/07 ↔
`C-RGKQ9SHAJ4` de Levi Aguirre), o sea que **lo más probable es que soporte ya
los haya cargado a mano en su momento**. Sin la org no se puede confirmar al
100%; propongo dejarlos y no cargar nada, para no arriesgar un doble cobro.

Los puentes internos del gerente (`agency_bm_bridge`, 9 movimientos por $234) ya
**no** cuentan como pago: la propia app los excluye de "Lo pagado"
(`isAgencyBmBridgeIntent`), así que la auditoría usa el mismo criterio.

Si alguna vez hay que curar: `node scripts/backfill-hecom-wallet-cobros.mjs --dry-run`.

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

## 3. Agenda de la auditoría conjunta

Por orden de plata en juego:

1. **¿El CRM cuenta los 142 cobros atados al gasto?** (1.6). $129,917 de 23
   clientes. Si no los cuenta, les estamos mostrando deuda que ya pagaron.
2. **Los 2 cobros con período futuro** (1.7). Uno solo, el de Daniel Hurtado,
   son $1,345.86 de deuda que no existe.
3. **Con qué mes se archiva un cobro** (1.2). La decisión de gerencia: hoy los
   automáticos y 449 manuales dicen cosas distintas.
4. **`UNIQUE` en `cobros.codigo`** (1.1). Tres líneas y cierra el riesgo de que
   un cliente vuelva a quedar cobrado doble. Ya pasó una vez.
5. **Los 145 cobros sin `periodo_resumen`** ($8,109 en Ely Aguirre, Alexis Cuba
   y Jerson Artezano): no aparecen en ninguna vista filtrada por mes.
6. **Unificar `Arnold Cilloniz`** y definir la ficha de login de Frank Cari y
   Fabian Hoyos (1.4).
7. **Las 16 fichas sin email** (1.9): ¿tienen que poder entrar a la plataforma?

Lo que llevo resuelto de mi lado: los 93 pagos conciliados, el duplicado de
Catherine borrado y los 79 automáticos alineados. No hace falta que el otro lado
toque nada de eso.

## 4. Fuera de cobros, cuando haya go

1. Dejar una sola fila por cuenta en las 6 de Carranza (revisando antes cuál
   tiene el saldo).
2. Alinear los 6 principales desalineados con sus mapeos.
3. Limpiar o marcar las 936 filas de orgs borradas.

---

## 5. Lo ya corregido el 16/09 (contexto)

| Commit | Qué |
|--------|-----|
| `af50607` | Los auto-abonos de Yape y banco manual ahora registran el cobro |
| `5df787d` | El cobro se archiva en el mes en que se pagó + backfill de 9 |
| `b7f91fc` | Liberar cuenta ads también limpia `clientes.tiktok_advertiser_id` |
| — | Borrada la fila duplicada del cobro de Catherine ($110 de más) |

Scripts disponibles:

| Script | Para qué |
|--------|----------|
| `audit-cobros-conciliacion.mjs` | Conciliar pagos vs cobros (`--fix-duplicados` para borrar repetidos) |
| `audit-hecom-saldos.mjs` | Deuda vs cobrado por cliente y mes; detecta meses pendientes ya pagados (`--cliente "nombre"` para el detalle) |
| `audit-hecom-proyectovv.mjs` | Auditar el resto del borde (fichas, cuentas, ad_accounts) |
| `backfill-hecom-wallet-cobros.mjs` | Curar pagos sin cobro (4 canales) |
| `realign-hecom-cobro-periodos.mjs` | Re-archivar cobros `AH-*` a su mes de pago |

### Cómo leer un caso puntual

Antes de concluir que un cobro falta, revisar en la app
`payment_intents.metadata.hecom_cobro_sync`: guarda el `codigo` y el
`periodo_resumen` que devolvió el puente. Si tiene `ok: true`, el cobro existe y
el tema es de período.

Y ojo con esto, que me hizo dar un falso positivo: **un pago puede estar
registrado con código de soporte** (`C-*`) en vez de `AH-*`. Pasa con los
anteriores al puente — el de $220 de Jesus Fuentes del 26/08 está bajo
`C-TAG4VGMS1N`. Buscar solo por `AH-*` hace parecer que falta plata.
