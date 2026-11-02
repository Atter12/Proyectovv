# Decisiones por cliente

Ruta: `/simulador`. Menú: **Decisiones por cliente**, solo para gerencia. La ruta valida sesión y los mismos permisos gerenciales que Pagos Profit. No se admite la vista “como cliente”.

## Flujo vigente · 02/11/2026

El resumen IA recibe la propuesta con importes monetarios ya convertidos y
moneda explícita, y el fee expresado como porcentaje. Nunca recibe los enteros
internos de centavos o puntos básicos como condiciones del crédito. Por ejemplo,
100000 centavos y 1000 puntos básicos se envían como USD 1000.00 y 10.00%, con
USD 100.00 de comisión y USD 1100.00 de devolución. El contexto histórico se
envía separado de la propuesta. La cabecera del análisis muestra las condiciones
exactas evaluadas desde el cálculo determinista, independientemente del texto IA.

La interfaz sigue **elegir cliente → definir propuesta → revisar resultado**.
Un buscador con selección directa reemplaza el buscador y selector separados.
Las dos opciones conservan sus valores al alternar entre fee y crédito; cambiar
de cliente o moneda limpia las propuestas. Las consultas anteriores se cancelan
para no mostrar resultados de otro cliente.

**Todo se evalúa por cliente.** El formulario y el resultado de fee identifican
al cliente seleccionado. No existe una modificación de fee general en este
flujo: ni simular ni descargar aplica tarifas, acuerdos o desembolsos.

El crédito separa capital, comisión y devolución total, con plazos rápidos de
7, 15 y 30 días. El fee compara ingreso actual y propuesto; las referencias,
fuentes y supuestos opcionales se abren a demanda. En móvil, el resultado aparece
antes de los detalles secundarios. Se mantienen los cálculos y permisos del
servidor. La vista previa de validación usa únicamente datos ficticios.

La pantalla de gerencia se centra en un cliente real. Seleccionar y evaluar carga en paralelo el score existente de Profit, costos conocidos y el FEE efectivo del endpoint de depósitos (con origen de cliente, cuenta o tarifa general). Los datos ausentes permanecen pendientes; no arranca con el ejemplo del PDF ni una comparación de toda la agencia.

Dos decisiones: **Evaluar cambio de FEE** y **Evaluar crédito**. La primera compara ingreso bruto por FEE con la tarifa actual y la propuesta sobre el gasto observado de 30 días, o una base manual expresamente identificada; permite ingresar un volumen comercial esperado y calcula el volumen para conservar el ingreso por FEE. No confunde el gasto observado con recargas facturadas ni ingreso con utilidad neta. La segunda calcula principal adicional comprometido, costo simple de financiación anual a 365 días para el plazo ingresado y FEE potencial si consume todo el crédito y devuelve principal y FEE puntualmente. No modela impago, deuda previa, impuestos ni otros costos. No aplica una tarifa ni desembolsa fondos.

La justificación comercial queda con la propuesta exportable por cliente. Cambiar cliente o moneda limpia datos y propuesta; reiniciar evaluación limpia el expediente. Las reglas y capacidad de pago se abren a demanda en crédito y conservan el motor de revisión existente. El score por sí solo no autoriza crédito. No se ha definido en el repositorio una política de límites y tolerancias aprobada por gerencia.

El archivo JSON de la propuesta incluye cliente, período, fuentes, supuestos, motivo, impacto y score consultado. Sigue siendo exportación local, no persistencia de expedientes en servidor. Las antiguas fichas de escenarios de agencia no se borran de localStorage, pero esa vista ya no es parte de este flujo.

Verificación: `scripts/test-client-impact.mjs`, regresiones de crédito/costos, 8 casos del score y navegador con datos de prueba (FEE, crédito, aislamiento de cliente, escritorio y 390 px).

## Antecedentes de la comparación genérica (retirada de esta pantalla)

## Qué resuelve

Compara tres escenarios mensuales de operación de la agencia. Permite variar base publicitaria, FEE, tasa de costo variable, costo fijo y porcentaje de cobros y pagos dentro del mes. Separa resultado operativo de flujo de efectivo propio. No mueve dinero, no cambia tarifas y no escribe registros en Hecom.

El ejemplo inicial es ficticio y reproduce la propuesta 02 de Hecom: 200.000 de base, 5% de FEE, 0,5% variable, 6.000 fijos → 3.000 de resultado. A 4,5% de FEE se requieren 225.000 de base para conservarlo. Cobrar 60% del FEE y pagar todos los costos produce −1.000 de flujo propio, conservando 3.000 de resultado.

## Estado entregado

- Comparación editable y cálculo determinista, sin IA en los importes.
- Una moneda y un mes por comparación; cambiar la moneda no convierte importes.
- Cálculos enteros en centavos y tasas en puntos básicos; redondeo mitad hacia arriba.
- Referencia manual con período, corte, origen, supuestos pendientes y notas.
- Fichas versionadas en localStorage, separadas por ID de usuario, hasta 50 en cada navegador.
- Exportación de ficha JSON e importación validada con la misma versión del motor; exportación de comparación CSV.
- Las importaciones recalculan resultados desde los supuestos, sin confiar en resultados adjuntos.
- Al abrir una ficha guardada se trabaja con una copia; guardar crea una nueva instantánea.
- El navegador puede bloquear o borrar el almacenamiento local: la UI informa errores y permite exportar.

## Límites explícitos

La primera versión usa supuestos manuales. No se han conectado datos históricos de Finanzas de Hecom, no hay persistencia en servidor ni sincronización entre dispositivos. Cada campo es un supuesto; la referencia de origen identifica la comparación completa. No se ha implementado calendario diario, impuestos, consolidación, financiación de medios, saldos iniciales ni saldos pendientes de períodos anteriores. Los importes de medios no son ingresos propios de Holistic.

Antes de importar cifras reales, validar el diccionario de base/FEE/ingresos propios, la moneda y el corte, la cobertura de registros y las exclusiones. La interfaz no presenta supuestos como datos reales.

## Comprobaciones

## Revisión de crédito

Se añadió una sección independiente de revisión manual. Compara exposición (deuda actual + solicitud), días de mora, cantidad de pagos, puntualidad y efectivo disponible para el plazo evaluado contra reglas ingresadas por gerencia. No trae umbrales ni una política predeterminada. Exige origen, corte/plazo de los datos y referencia/versionado de la política. Campos vacíos significan datos desconocidos. Devuelve falta de datos, incumplimiento de reglas o cumplimiento sujeto a revisión gerencial; no aprueba ni deniega créditos, no modifica límites ni concede fondos. Las comparaciones usan productos enteros para no aceptar ratios insuficientes por redondeo.

La revisión se exporta como JSON separado; no se persiste con las fichas locales de rentabilidad ni se sincroniza con Hecom. La rentabilidad de la agencia no se usa como prueba de solvencia del cliente. Pendiente: reglas aprobadas por Holistic, fuentes históricas reconciliadas, corte de deuda y vencimientos, evidencia de capacidad de pago y validación de utilidad con gerencia.

Se conectó la consulta existente `/api/profit` para mostrar contexto real del cliente seleccionado: depósitos Holistic confirmados e intentos fallidos a 90 días, cartera registrada, gasto, días activos, CPA por pedido cobrado, CPM y ROAS cuando existen datos. La consulta valida la sesión y el cliente como en Profit; no permite consultar libremente IDs. Los depósitos proceden del ledger Holistic y sus consultas actuales tienen límite de 200 registros: no se presentan como historial consolidado. Los datos ausentes se muestran como desconocidos. Esta consulta no completa automáticamente la revisión manual, no calcula puntualidad a partir de intentos fallidos y no convierte métricas publicitarias en una aprobación de crédito. Pendiente integrar importes/fechas de recargas, frecuencia precisa, vencimientos y deuda conciliada.

La revisión v2 exige también datos por venta cobrada: ingreso neto, producto, entrega/devoluciones, CPA y comisiones/costos variables. Calcula su contribución y la utiliza como señal: si es cero o negativa, la revisión muestra señales desfavorables aunque se cumplan los ratios de pago. Faltando alguno de esos importes, no concluye que el expediente esté completo. Una contribución positiva antes de gastos fijos no prueba solvencia. No se considera un CPM bajo como prueba de rentabilidad y no se equipara CPA de leads/clics a CPA de ventas cobradas.

### Carga automática de costos conocidos

`/api/simulator/known-costs` valida sesión, acceso gerencial y cliente seleccionado. Consulta únicamente tiendas activas vinculadas al cliente y sus pedidos del rango predeterminado de Profit (por fecha de creación). Devuelve promedios de importe cobrado y producto sobre pedidos cobrados, mensajería de todos los pedidos por venta cobrada (para reflejar entregas fallidas) y gasto Holistic/TikTok USD por pedido cobrado cuando hay gasto registrado compatible. Rechaza mezcla de monedas, ausencia de moneda y truncamiento de más de 10.000 pedidos. Importes de costos vacíos o cero sin confirmar quedan pendientes. No supone el costo de empaque ni otras comisiones.

El botón “Completar costos conocidos desde Profit” limpia los datos de la solicitud anterior, identifica cliente y corte, carga solo importes conocidos y enumera lo que falta. Se recalculan los resultados automáticamente al completar los campos pendientes. Cambiar moneda limpia los importes en lugar de convertirlos tácitamente.

Comprobación de cobertura el 31/10/2026 en la base configurada localmente: existen columnas `rp_products.cogs_amount`, `packaging_amount` y `rp_orders.product_cost_amount`, `courier_cost_amount`, pero la consulta devolvió 0 pedidos en estado `collected` y 0 productos con `cogs_amount > 0`. Tener el esquema no implica disponer de costos reales. El flujo declara esta ausencia sin inventar datos. Las reglas de crédito (límite de exposición, mora tolerada, historia mínima, puntualidad y cobertura) son una política de Holistic, no métricas obtenibles de TikTok.

Referencia conceptual de capacidad de pago e historial: https://www.sba.gov/loans/7a-loans/ . Es una referencia de evaluación; no se aplica normativa SBA a Holistic ni se adoptan criterios regulatorios estadounidenses.

`node scripts/test-business-simulator.mjs`: casos del PDF, diferencia entre resultado y cobro, base requerida, redondeo, validaciones y compatibilidad de versiones. TypeScript y ESLint de los archivos del flujo. Comprobación en navegador: editar cobro Base a 60% conserva resultado en 3.000 y cambia flujo a −1.000; guardar crea una ficha local. Revisión visual de escritorio y móvil.

## Detección automática del FEE

Al elegir cliente o cambiar moneda se inicia la consulta sin un segundo clic. `/api/simulator/client-fee` exige sesión activa y permisos de gerencia, rechaza vista como cliente y se limita al cliente seleccionado. Prioriza acuerdo CRM normalizado, luego una tarifa uniforme de cuentas; acuerdos diferentes por cuenta requieren revisión. Sin acuerdo usa la última recarga verificable, nunca un 10% predeterminado.

Revisa hasta 100 pagos exitosos de 180 días explícitamente atribuidos al cliente y cruza cada uno con un único depósito contable publicado del mismo pago y organización, en USD. Excluye deuda, cobros faltantes, devoluciones/reversiones, abonos inconsistentes y monedas sin conversión documentada. Pago manual USD o PEN usa importe confirmado y FX histórico registrado, no OCR sin confirmar. Stripe/Whop requieren recargo de pasarela explícito y lo descuentan. FEE = (pago equivalente USD / crédito real USD − 1) × 100 − recargo. Tarifa registrada coherente con importes tiene prioridad sobre la inferencia redondeada.

La UI muestra origen, pago, saldo acreditado, tipo de cambio y advertencias sobre discrepancias o tasas variables. Permite usar una recarga como referencia para la simulación, sin modificar acuerdos ni dinero. Tests: `scripts/test-client-fee.mjs`; validación del acuerdo de Alex Barra en CRM (10% cliente y dos cuentas), sin mutaciones. El historial financiero productivo no se inspeccionó por ausencia de acceso local a su credencial protegida.


## Evaluacion simplificada de credito

El flujo principal pide monto, FEE porcentual y plazo en dias. El FEE se aplica una sola vez: 2500 al 10% durante 7 dias devuelve 2750 al finalizar el plazo. No renueva ni desembolsa.

POST /api/simulator/credit-analysis verifica gerencia y cliente seleccionado, consulta recargas confirmadas y cartera, saldo estimado Hecom, Profit y costos disponibles. Resume frecuencia, importe habitual, anuncios, score y contribucion parcial cuando faltan costos. Recargas no son cuotas pagadas a tiempo; ROAS no es utilidad neta. La IA configurada resume evidencia y faltantes, sin aprobar ni denegar. Si no responde, conserva los hechos y calculos. La evaluacion se puede descargar y la decision sigue siendo de gerencia.
