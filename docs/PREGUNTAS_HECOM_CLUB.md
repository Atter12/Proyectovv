# Preguntas para el equipo de Hecom Club

**16/09/2026 · desde Proyectovv (Ads Holistic) · SOLO RESPONDER, NO APLICAR NADA**

Estamos haciendo la auditoría en paralelo y vamos a aplicar los cambios juntos
después, con el go de Victor. Si los dos tocamos las mismas filas al mismo tiempo
nos pisamos. **Por favor contestar sin modificar datos ni schema.**

---

## Lo que ya cambiamos de nuestro lado (para que no lo rehagan)

Hoy 16/09 escribimos en la base de Hecom desde Proyectovv. Lo dejo explícito
para que no aparezca como sorpresa:

| Qué | Detalle |
|-----|---------|
| Borramos 1 fila de `cobros` | La duplicada de Catherine Burgos, `id 7a4af39f-21b0-4590-9ee8-594d27b1fdea`. Quedó `23bfd7da-3170-44be-8501-a8af42b17406` |
| Movimos `periodo_resumen` de 8 cobros `AH-*` | Al mes de su `fecha` de pago |
| Corregimos 2 `periodo_resumen` con mes futuro | `C-MCK0BW0BOK` (Daniel Hurtado) `2026-12` → `2025-12` y `C-U4GD3HK3P8` (Yolmer Eugenio) `2026-10` → `2026-09` |

Nada más. **No tocamos ningún otro cobro manual, ni `gastos`, ni `clientes`.**

---

## 1. ¿El CRM cuenta los cobros que están atados al gasto y no al cliente?

**Es la pregunta más importante: son $129,917.66 de 23 clientes.**

Hay **142 cobros** con `client_id = NULL`, `periodo_resumen = NULL` y `gasto_id`
apuntando a un gasto válido. Por las fechas (`created_at` de enero a junio 2026,
casi todos de `branlyn.lopez.r@gmail.com`) parecen del modelo anterior, cuando el
cobro se colgaba del gasto en vez del cliente.

Ejemplo: `C-LZQBBLMRNL`, $183.78, `gasto_id` → gasto de Yim Villar de `2025-12`.

**Lo que necesitamos saber:**

1. ¿La ficha del cliente y la pestaña de Cobros los suman haciendo join por
   `gasto_id`, o solo leen los que tienen `client_id`?
2. Si solo leen `client_id`: ¿se pueden rellenar `client_id` y `periodo_resumen`
   desde el gasto (`gastos.client_id` y `gastos.mes`), o hay algún motivo para
   que estén en NULL que no estamos viendo?
3. ¿Hay alguna otra vista o reporte que dependa de que estén en NULL?

**Cómo verificarlo en 30 segundos** — abrir la ficha de **Alexis Ancalle**:

- Sus gastos suman **$25,993.67** de deuda.
- Tiene **$8,884.36** en cobros con `client_id`.
- Y **$17,110.28** en 7 cobros atados al gasto, sin `client_id`.

Si la ficha le muestra ~$17,109 de deuda, **no los está contando** y le estamos
reclamando plata que ya pagó. Si le muestra ~$0, está todo bien y esta pregunta
se cierra acá.

Los más afectados si no se cuentan:

| Cliente | Deuda que mostraría | Deuda real |
|---------|--------------------|-----------|
| Alexis Ancalle | $17,109.31 | $0 |
| Ely Aguirre | $65,731.42 | $25,352.96 |
| Jerson Artezano | $48,309.76 | $9,528.40 |
| Cainan Aguirre | $10,074.44 | $0 |
| Yim Villar | $8,003.29 | $0 |
| Renzo Cruz | $6,547.50 | $0 |
| Dam Aguirre | $10,188.73 | $6,173.77 |

## 2. ¿Cómo calcula el CRM la deuda y lo cobrado de cada mes?

Nosotros lo reconstruimos así, y queremos confirmar que es lo mismo que muestra
la interfaz, porque si no, todos nuestros números están corridos:

- **Deuda del mes** = suma de `gastos.gasto * (1 + gastos.fee / 100)`,
  agrupando por `gastos.mes`.
- **Cobrado del mes** = suma de `cobros.monto` agrupando por
  `cobros.periodo_resumen`.

Preguntas concretas:

1. ¿El `fee` es un porcentaje sobre el gasto? (Lo deducimos porque los pagos dan
   múltiplos de 1.10 con `fee = 10`, pero mejor confirmarlo.)
2. ¿Agrupan por `gastos.mes` o por `periodo_inicio` / `periodo_corte`?
3. ¿`gastos.prepago = true` se trata distinto? (hoy hay 1 sola fila así)
4. ¿Las `garantias` descuentan deuda o van por separado?

## 3. ¿Qué significa `periodo_resumen` por diseño?

Esta es la que necesita decisión de producto, no solo dato.

Comprobamos que el endpoint `/api/credito-cobros-holistic-wallet` **ignora el
`periodo_resumen` que le mandamos** y le asigna **el período más viejo que el
cliente tiene sin cubrir**. Un pago del 12/09 de un cliente con deuda de mayo
quedaba archivado en `2026-05`, y como el CRM filtra por período y no por fecha
de pago, el pago parecía no haberse registrado. Eso fue lo que nos reportaron con
Jan Alex.

Gerencia definió que **el cobro tiene que vivir en el mes en que entró la plata**,
así que por ahora lo corregimos nosotros después de crear el cobro.

Pero al auditar vimos que **449 de los 1,060 cobros cargados a mano están en un
mes distinto al de su fecha de pago** (por $1,109,520), y el patrón es casi
siempre el mes anterior: 92 pagados en mayo están en abril, 66 pagados en julio
están en junio, 42 pagados en setiembre están en agosto.

1. ¿`periodo_resumen` significa "el mes en que se pagó" o "el mes que el pago
   cubre"? Porque hoy los automáticos dicen una cosa y esos 449 dicen la otra.
2. ¿Ese desfase de los manuales lo elige el equipo a propósito al cargarlos, o se
   lo asigna la interfaz sola con la misma lógica de deuda más vieja?
3. Si la regla va a ser el mes de pago: ¿pueden moverla al endpoint (o aceptar el
   `periodo_resumen` del payload) para que no tengamos que corregir después?
4. ¿El CRM tiene forma de mostrar saldo a favor arrastrado entre meses? Lo
   preguntamos porque con la regla del mes de pago, el cliente que paga
   adelantado siempre va a mostrar el mes del gasto pendiente y el mes anterior a
   favor. Hoy nos pasa con 10 clientes ($636 en total; el mayor es Patrick Oddar,
   $353.55 pendientes en `2026-09` con $423.30 a favor en `2026-08`).

## 4. `cobros.codigo` no tiene UNIQUE y ya generó un doble cobro

A Catherine Burgos le quedaron registrados **$220 por un pago de $110**: dos
filas con el mismo `codigo`
(`AH-STRIPE-b8422a3d-4177-40fa-a870-4e99adb2026f`), creadas con **77 ms de
diferencia** (`18:36:44.718` y `18:36:44.795`).

Nosotros llamamos al endpoint dos veces para el mismo pago a propósito (ganador y
perdedor del claim del webhook), confiando en que el `codigo` lo hace
idempotente. Si el chequeo es un `SELECT` y después un `INSERT`, las dos llamadas
pasan el chequeo antes de que cualquiera inserte.

1. ¿Existe algún índice único en `cobros.codigo`? (por lo que vimos, no)
2. ¿Pueden agregarlo, o pasar el insert a `UPSERT ... ON CONFLICT (codigo)`?
3. Cuando haya conflicto, ¿el endpoint puede responder `ok: true` con
   `idempotent: true` en vez de error? Si responde error, nuestro lado lo marca
   como fallido y lo reintenta, que es peor.

## 5. Los 145 cobros sin `periodo_resumen`

Además de los 142 del punto 1, quedan cobros sin período que suman **$8,109.69**
en 3 clientes: Ely Aguirre ($5,000), Alexis Cuba ($1,817.69) y Jerson Artezano
($1,292).

1. ¿Aparecen en alguna vista, o son invisibles en todo lo que filtre por mes?
2. ¿Con qué criterio habría que rellenarlos?

## 6. Fichas: duplicados y logins ambiguos

Esto afecta el login a la plataforma, que resuelve al cliente por email.

1. **DNI 71012732** está en dos fichas: `Arnold Cilloniz` (`9502038c`) y
   `Arnold Cilloniz` (`8e2c8278`). ¿Cuál es la buena? ¿Unificamos como hicimos
   con Piero Acasiete?
2. Dos emails están en dos fichas cada uno. ¿Cuál debe ser la de login?
   - `fcarimo.alexander@gmail.com` → `Frank Cari` y `Frank Cari - Mexico`
   - `notcount9001@gmail.com` → `Fabian Hoyos - Ecuador` y `Fabian Hoyos - Colombia`
3. Hay **16 fichas sin ningún email**. ¿Se espera que esos clientes entren a la
   plataforma? Hoy no pueden.
4. **155 de 188 fichas tienen DNI placeholder `CL-*`**. ¿Se van a completar? Nos
   deja sin llave para detectar duplicados.

## 7. ¿Quién más escribe en `cobros`?

Para saber con qué tenemos que convivir:

1. Aparte de la interfaz de Hecom y nuestro endpoint, ¿hay otro proceso que
   inserte o actualice `cobros`?
2. ¿Hay algún trigger o job que recalcule `periodo_resumen` después? Lo
   preguntamos porque si existe, nuestra corrección se va a pisar sola.

---

## Resumen de lo que pedimos

Solo respuestas, en el orden que les quede cómodo. **Nada de aplicar cambios
todavía** — cuando Victor dé el go lo hacemos juntos y en orden.

Lo más urgente de contestar es el **punto 1**: de eso depende si hay 23 clientes
a los que no se les puede reclamar deuda.
