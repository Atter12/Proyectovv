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

**Respondido el 16/09:** confirmado que no hay ningún índice único en `cobros`
(los que hay son sobre `fecha`, `created_at`, `periodo_resumen`, `client_id`,
`gasto_id` y `(client_id, periodo)`).

La buena noticia: **el endpoint ya está escrito esperando ese índice.** Hace
SELECT por código y, si el INSERT falla, vuelve a buscar y responde
`ok: true, idempotent: true` — justo lo que necesitábamos. Ese camino nunca se
ejecuta porque la base no rechaza el duplicado. Creando el índice, el
comportamiento aparece solo, sin tocar el endpoint.

Se puede crear ya: hoy hay 0 códigos duplicados y 0 cobros sin código.

Mientras no exista el índice, el chequeo queda en la auditoría:
`audit-cobros-conciliacion.mjs` sección 1 los detecta, y con
`--fix-duplicados` borra las filas de más (solo toca `AH-*`).

### 1.2 🔴 ALTA · Hoy convivimos con dos reglas de período distintas

> **Respondido el 16/09.** Por diseño `periodo_resumen` es el mes de deuda más
> antiguo sin cubrir (`resolvePeriodoResumen()`), y el mes del pago solo si el
> cliente no debe nada. Una precisión suya: el endpoint **no ignora** el período
> que le mandamos, **no lo acepta** — el body no tiene ese parámetro. Se puede
> agregar como opcional.
>
> Y el dato que decide esto: **el desfase de los manuales no lo pone la
> interfaz**, el panel guarda lo que escribió la persona. Por autor: annie 218
> cobros ($545,200.88), branlyn 146 ($417,108.48), gian 62 ($76,260.10), sebas
> 18 ($68,196.43). O sea que es una convención del equipo, no un bug.
>
> Nuestros 448 vs sus 449 cuadran exacto: la diferencia es de $100 y es el cobro
> de Yolmer que corregí en el medio.
>
> Sobre mostrar saldo a favor: el core lo calcula (`poolRemaining`) pero ninguna
> pantalla lo expone. Exponerlo es desarrollo nuevo.

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

### 1.4 🔴 ALTA · Fichas duplicadas — **la causa es nuestra** (ver 2.5)

**Arnold Cilloniz son tres fichas, no dos**, y la que tiene la historia no es
ninguna de las que había mirado (mi chequeo por DNI no la ve, porque tiene DNI
placeholder). Las tres comparten el teléfono `...941285114`:

| Ficha | DNI | Alta | Movimiento | Email |
|-------|-----|------|-----------|-------|
| `6e55c5d2` | `CL-M8HDPDZQ` | 02/05, del panel | **4 gastos · $1,565.76** | mkt.tiktokads.cl@ |
| `9502038c` | 71012732 | 10/09 21:03, **alta nuestra** | vacía | arnold.cilloniz@ |
| `8e2c8278` | 71012732 | 10/09 21:04, **alta nuestra** | vacía | cali.bobadilla.6@ |

**Arnold hoy entra a la plataforma y no ve su historia**, porque su login cae en
una ficha vacía. Lo coherente es pasar el DNI real a la ficha con movimiento y
borrar las dos vacías, pero eso lo decide quien tenga el dato.

Y aparecieron dos duplicados más, que no son nuestros, detectados por teléfono
(no por DNI, porque ambos lados tienen placeholder):

| Fichas | Teléfono | Situación |
|--------|----------|-----------|
| `Maurycio Pury` · `Maurycio Puri` | ...997774640 | **las dos con movimiento** (10 gastos/8 cobros y 8 gastos/4 cobros). Hay que fusionar |
| `Luis Alberto Moreno Reymundo` · `Luis Moreno` | ...912825839 | la historia está en la de DNI placeholder (20 gastos); la del DNI real está vacía |

**Los emails repetidos NO son duplicados.** Hecom confirmó que las dos fichas de
cada par tienen movimiento real y distinto:

| Par | Movimiento |
|-----|-----------|
| `Frank Cari` · `Frank Cari - Mexico` | 112 gastos ($7,671.55, saldo $329.20) · 22 gastos ($316.27, saldo $0) |
| `Fabian Hoyos - Colombia` · `- Ecuador` | 97 gastos (saldo $743.36) · 127 gastos (saldo $0.04) |

Son operaciones distintas del mismo dueño y fusionarlas mezclaría cuentas. Lo
que hay que resolver es **cómo desempata el login**, no la ficha.

### 1.5 🟡 RESPONDIDO · Los 145 cobros sin `periodo_resumen`

Son los 142 del punto siguiente más 3 con `client_id`: Ely Aguirre ($5,000),
Alexis Cuba ($1,817.69) y Jerson Artezano ($1,292).

**No son invisibles en Crédito**: el core les asigna mes por respaldo — el del
gasto si tienen `gasto_id`, y la fecha del cobro si no. Sí son invisibles en
cualquier consulta que filtre por la columna `periodo_resumen`, que es
exactamente lo que me pasó a mí.

Criterio para rellenarlos: el mes del gasto cuando hay `gasto_id`, y el mes de la
fecha de pago para los 3 que no lo tienen. Es lo que el core ya usa.

### 1.6 🟡 RESPONDIDO · Los 142 cobros atados al gasto sí se cuentan (casi siempre)

> Contestado por Hecom Club el 16/09, y verificado contra nuestros datos.

Hasta junio el cobro se ataba al **gasto** (`cobros.gasto_id`) y no al cliente:
142 filas con `client_id = null` y `periodo_resumen = null`, por $129,917.66 de
23 clientes. No es un error de carga: **el formulario de cobro del panel fuerza
`client_id = null` cuando el cobro se ata a un gasto** y deja el período vacío
porque lo hereda del gasto.

**La ficha de gerencia y la lista de deudores sí los cuentan**, porque el core
los imputa a la línea del gasto sin mirar `client_id`. O sea que **no hay 23
clientes a los que no se les pueda reclamar**, que era mi preocupación.

Pero hay dos superficies que leen los cobros filtrando por `client_id` y por eso
no los cuentan:

1. **El link público del cliente** (`/api/credito-cliente-deuda-resumen`). A
   Alexis Ancalle su propio link le muestra **$17,109.32 de deuda que ya pagó**.
   Está vivo hoy y lo ve el cliente.
2. **La fórmula de los envíos de WhatsApp** (`resumenMesCliente`). Sobre los 23
   clientes pediría **$122,751.53 más** que la ficha, y 9 de ellos deben $0. Los
   pagos a línea son de diciembre a marzo, así que un envío del mes corriente no
   se rompe; sí se rompe si se cobra uno de esos meses viejos.

Las dos correcciones son de una línea y son de su lado. Ellos probaron rellenar
las 142 filas (`client_id` del gasto y `periodo_resumen` del mes del gasto) y la
deuda FIFO **no cambia en ninguno de los 23**, así que es seguro.

**Y me corrige un cálculo:** la deuda de Hecom es FIFO con arrastre (lo que sobra
de un mes cubre líneas de otros) y las garantías Vigente descuentan ($60,925.34
en 159 filas). Mi resta mes contra mes siempre da de más. Verificado:

| Cliente | Mi resta simple | Mi resta menos garantías | Deuda real (ficha) |
|---------|----------------|-------------------------|--------------------|
| Alexis Ancalle | $17,109.31 | $0 | **$0** |
| Ely Aguirre | $25,352.96 | $2,252.94 | **$10,232.81** |
| Jerson Artezano | $9,528.40 | $5,183.78 | **$8,959.62** |

La cifra que vale es la de la ficha. Ya marqué el script para que nadie use mis
montos para cobrar.

### 1.7 ✅ RESUELTO · Dos cobros archivados en un mes que todavía no llegó

Un período futuro es siempre un tipeo, y deja el mes real pendiente. Corregidos
el 16/09 con autorización de Victor:

| Cliente | Monto | Pagado | Estaba en | Quedó en |
|---------|-------|--------|-----------|----------|
| Daniel Hurtado | $1,345.86 | 2026-01-07 | `2026-12` | `2025-12` |
| Yolmer Eugenio | $100.00 | 2026-09-07 | `2026-10` | `2026-09` |

Los dos tipeos eran distintos y por eso la corrección no es "mandarlo al mes de
pago" a ciegas:

- **Yolmer**: se equivocaron en el mes. El período real es el de la fecha de pago.
- **Daniel**: se equivocaron en el **año** (`2026-12` por `2025-12`). Mandarlo al
  mes de pago (`2026-01`) habría dejado `2025-12` pendiente igual, solo corriendo
  la deuda fantasma de mes. Se confirma solo: su `2025-12` debía **exactamente
  $1,345.86**. Después de corregir quedó en $0.00 y su ficha cuadra completa.

El script elige entre los dos candidatos (mes de pago o año corregido) el que
cubra un mes que figura pendiente, y si ninguno aplica usa el mes de pago:
`node scripts/audit-hecom-saldos.mjs --fix-periodos-futuros`.

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

### 2.5 🔴 ALTA · Nuestro alta por OTP duplica fichas (2 de 7)

Esta es la causa de los duplicados de 1.4, y la encontré siguiendo el dato de
Hecom de que las fichas vacías de Arnold las creó "un proceso del servidor".
Ese proceso somos nosotros.

`createHecomCliente` en `lib/hecom/clientes.server.ts` valida duplicados
**solo por email**:

```ts
const existing = await findHecomClientesByEmail(email);
if (existing.length > 0) return { ok: false, code: "duplicate_email" };
```

No mira DNI ni teléfono. Y `clientes.dni` no tiene restricción de unicidad en
Hecom, así que nada lo frena en la base tampoco. La misma persona que se registra
con otro correo se lleva una ficha nueva.

**Resultado:** de las **7 fichas** que creó nuestro alta desde el 10/09,
**2 son duplicados por DNI** (Arnold ×2, Piero ×2) y **5 quedaron sin ningún
movimiento**. Arnold se registró dos veces en un minuto, con dos correos, y las
dos veces le creamos ficha.

Peor: su ficha real tiene **DNI placeholder** (`CL-M8HDPDZQ`) y otro email, así
que validar por DNI tampoco lo habría atrapado. En Hecom **155 de 188 fichas
tienen DNI `CL-*`**, pero casi todas tienen teléfono — y de hecho las tres fichas
de Arnold comparten el teléfono. **El teléfono es la mejor llave para detectar
que la persona ya existe.**

**Cuidado con la solución fácil:** no se puede fusionar automático al encontrar
un DNI o teléfono repetido. Los dos son datos que el usuario declara y nadie
verifica, así que sumarle el email a una ficha existente permitiría entrar a la
ficha de otro —con sus cuentas y su saldo— poniendo su DNI. Lo seguro es
**rechazar el alta y derivar a soporte**, que revisa y agrega el email a mano.

Queda pendiente de tu go porque define qué ve el cliente al registrarse.

### 2.6 🔵 BAJA · 936 `ad_accounts` de orgs borradas

Restos de importaciones de julio repartidos en 8 orgs que ya no existen. De 80
revisadas, 1 con saldo y 0 con gasto. No se ven en ningún panel; sólo ensucian
las consultas por advertiser (fue lo que me hizo ver "194 duplicados" cuando los
reales son 6).

---

## 3. Plan de aplicación coordinado

Hecom ya contestó las 7 preguntas (16/09). Lo que queda, con dueño claro para que
nadie pise al otro:

### Decisiones que necesitan a Victor

| # | Qué | Impacto |
|---|-----|---------|
| D1 | **Con qué mes se archiva un cobro** (1.2) | Hoy los 79 automáticos usan el mes de pago y 448 manuales el mes que cubren, por $1,109,420. Hecom confirmó que el desfase **lo elige quien registra el cobro a mano**, no la interfaz |
| D2 | **Qué ve el cliente si su DNI o teléfono ya existe** (2.6) | Define si rechazamos el alta y derivamos a soporte. No se puede fusionar automático: es un riesgo de entrar a la ficha de otro |
| D3 | **Qué hacer con las 3 fichas de Arnold** y el par Maurycio Pury/Puri (1.4) | Arnold hoy no ve su historia al entrar |

### Lo que aplica Hecom Club

| # | Qué | Nota |
|---|-----|------|
| H1 | Que el link público del cliente cuente los pagos atados al gasto | A Alexis le muestra $17,109 que ya pagó. **Lo ve el cliente hoy** |
| H2 | Lo mismo en la fórmula de WhatsApp | Pediría $122,751 de más sobre 23 clientes |
| H3 | `UNIQUE` en `cobros.codigo` | Hay 0 duplicados y 0 sin código, así que entra sin limpieza previa. El endpoint **ya está escrito** para responder `idempotent: true` en el conflicto; hoy ese camino nunca corre |
| H4 | `periodo_resumen` opcional en el body del endpoint | Sale de D1 |
| H5 | Rellenar las 142 filas + las 3 sin período | Probado: no mueve la deuda FIFO de ninguno de los 23 |

### Lo que aplico yo

| # | Qué | Nota |
|---|-----|------|
| P1 | Validar DNI **y teléfono** en el alta OTP (2.6) | Sale de D2 |
| P2 | Apagar nuestra corrección de período si D1 va al endpoint | `HECOM_COBRO_PERIODO_ALIGN=false` y borrar el código |
| P3 | Las 6 cuentas duplicadas de Carranza y los 6 principales desalineados | Fuera de cobros |
| P4 | Limpiar las 936 `ad_accounts` de orgs borradas | Fuera de cobros |

### Ya cerrado, sin nada pendiente

Los 93 pagos conciliados · el doble cobro de Catherine · los 79 automáticos
alineados · los 2 períodos futuros (1.7) · el cobro huérfano `C-R1DPLOCPPY`
(respondido: no es de la plataforma, ver 4).

## 4. El pendiente que nos dejaron: `C-R1DPLOCPPY`

$110 por Interbank, fecha 30/06, cargado por branlyn el 01/07, sin cliente y sin
gasto. Es el único cobro de la tabla que no se le acredita a nadie.

**No salió de la plataforma.** Nuestro pago más viejo es del **2026-07-06** y
entre el 20/06 y el 05/07 no hay ningún pago registrado, de ningún monto. Además
Interbank nunca fue un canal nuestro: manejamos Stripe, BCP, Yape y USDT.

Es una transferencia que recibió el equipo directo, de antes de que existiera la
plataforma. Hay que identificarla del extracto de Interbank del 30/06; desde acá
no hay con qué cruzarla.

Lo que llevo resuelto de mi lado: los 93 pagos conciliados, el duplicado de
Catherine borrado y los 79 automáticos alineados. No hace falta que el otro lado
toque nada de eso.

## 5. Fuera de cobros, cuando haya go

1. Dejar una sola fila por cuenta en las 6 de Carranza (revisando antes cuál
   tiene el saldo).
2. Alinear los 6 principales desalineados con sus mapeos.
3. Limpiar o marcar las 936 filas de orgs borradas.

---

## 6. Lo ya corregido el 16/09 (contexto)

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
