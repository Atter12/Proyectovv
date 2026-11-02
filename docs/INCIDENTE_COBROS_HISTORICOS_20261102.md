# Cobros históricos y deuda mensual — 2026-11-02

La reclasificación de cobros para cuadrar tarjetas mensuales se retiró en Hecom. No debe recrearse mediante nuevas garantías, recibos sintéticos ni cambios automáticos de período. El motor FIFO ya aplica pagos y anticipos registrados al gasto.

Ads debe distinguir ingreso registrado al período de gasto cubierto por el historial. El importe reclamable se obtiene del motor canónico de Hecom con gastos, cobros directos o ligados a gastos y garantías; una resta entre dos totales mensuales no sustituye ese cálculo.

`lib/hecom/debt-core.cjs` es una copia exacta del motor de `api/credito-deuda-core.js` en Hecom `d0c734b8`. Las futuras actualizaciones deben conservar su paridad y pasar `node scripts/test-hecom-debt-settlement.mjs`. No se deben introducir reglas independientes de garantía o pasarela en el adaptador.

El adaptador consulta un cliente ya autorizado y pagina con conteo exacto, incluyendo errores y cambios de conteo como estado no disponible. Solo envía totales mensuales al navegador. Si falla una fuente, la UI muestra saldo por verificar, el enlace público no precarga un cobro y el snapshot de cobranza falla explícitamente. No se acredita cartera ni se modifican cuentas publicitarias.

La vista de movimientos financieros completos también pagina: pedir un límite superior al máximo de una respuesta de Supabase no recuperaba todas las filas. El límite visual existente se conserva con su aviso, mientras el cálculo de deuda requiere historial completo.

Pruebas: pagos de otros períodos, anticipos, aislamiento entre clientes, más de mil gastos, lectura incompleta y representación del saldo/cobertura sin convertir pagos históricos en ingresos. Los datos del caso real, comprobante y auditorías se conservan fuera de documentación versionada.

Ads se publicó mediante `dpl_HSdDFcoz2JG8ptQDv7M55jGGhgvf`, desde las 1.320 fuentes verificadas de `dpl_DnMeSbg2ojCwR5JWugJdiY481qt7`, incorporando únicamente esta corrección y sus traducciones. Se verificó el alias productivo efectivo, el estado de cuenta público autorizado y la respuesta del snapshot interno con el mismo importe pendiente. El comprobante y el único ingreso del período también quedaron verificados. No se enviaron mensajes ni se actualizó gasto TikTok durante esa prueba.

La integración de repositorio `3ce92388` ya incorporó el adaptador y la mayoría de cambios. Este cierre completa el KPI de gasto cubierto, las traducciones correspondientes y las regresiones de representación, preservando las otras funcionalidades de esa integración. La verificación local de tipos de la entrega y las pruebas financieras/representación pasaron; los archivos privados de la comprobación productiva permanecen fuera del repositorio.
