# Estado de cuenta público: diseño y respaldo

## Alcance

La ruta `/p/lo-pagado/[token]` presenta primero el saldo del mes y el acceso al pago. Conserva el cálculo mensual existente y el flujo de transferencia con comprobante. La confirmación automática con pasarelas se implementará por separado.

El diseño utiliza la marca, tipografía y colores existentes de Holistic. Prioriza lectura, contraste y uso táctil; no añade animaciones decorativas. Ocupa el ancho disponible con márgenes laterales de 16 a 32 px. Desde 1280 px, una misma cuadrícula alinea el resumen con el gráfico y el bloque de pago con el historial. Saldo y corte comparten una fila dentro del resumen; el desglose queda debajo. La acción de pago forma un bloque con título y explicación, centrado verticalmente. En móvil se apilan resumen, desglose, pago y detalle.

«Ya pagué y no aparece» se encuentra al final de «Tus pagos del mes». Su formulario utiliza una sola columna para que los campos sean legibles tanto en el historial lateral de escritorio como en móvil. El reporte conserva el período del enlace, los datos filtrados para la vista pública y los mismos endpoints.

## Revisión de diseño

| Before | After | Why |
| --- | --- | --- |
| La acción de pago estaba después de un informe largo. | Saldo, fecha de corte y pago aparecen al inicio. | El cliente entiende cuánto corresponde pagar antes de explorar movimientos. |
| El botón quedaba aislado arriba de una columna con mucho espacio vacío y una proporción distinta al resto de la página. | Bloque de pago con título, explicación y botón, centrado junto al resumen; sus límites coinciden con el historial inferior. | Agrupa la acción y su contexto, equilibra la cabecera y mantiene alineaciones estables. |
| El gráfico diario quedó ausente en la primera versión del rediseño. | Gráfico diario siempre visible, con anuncios más comisión, pagos y acumulados del día seleccionado. | Conserva la visión de la evolución del gasto junto al detalle numérico. |
| El detalle del gráfico requería hacer clic y permanecía en un día. | El puntero muestra cada día y, al salir, vuelve al total hasta la fecha. El selector y el teclado también permiten consultar días y regresar al total. | Facilita explorar el gasto y recuperar el contexto del período sin clics adicionales. |
| En móvil, todas las columnas del mes se comprimían en el ancho de la tarjeta. | Cada día dispone de 44 px; el gráfico se desliza horizontalmente con el eje de importes fijo. El selector, las flechas y el teclado llevan la columna elegida a la vista. | Separa las barras y facilita consultar cada día sin desbordar la página ni omitir datos. |
| La columna central dejaba amplios espacios vacíos en escritorio. | Ancho fluido, gráfico principal e historial lateral; detalles desplegables debajo. | Aprovecha la pantalla y mantiene una lectura ordenada en móvil. |
| El reporte de comprobantes estaba separado del historial, dentro de la cabecera. | «Ya pagué y no aparece» queda debajo de los pagos, con formulario de una sola columna. | Permite revisar los pagos antes de reportar uno faltante y conserva campos legibles en la columna lateral. |
| Los importes y estados tenían poco contexto. | Moneda, importe aplicado, cargos de procesamiento y estados explícitos. | Evita confundir un envío en revisión con un pago aplicado. |
| El diálogo permitía perder el foco hacia el fondo. | Foco contenido, Escape, bloqueo del fondo y retorno al botón de origen. | Mejora navegación por teclado y evita acciones involuntarias durante el envío. |

Criterios aplicados: Emil Kowalski (interacción y foco), Design Taste Frontend (composición y coherencia, adaptadas a un portal de producto), Impeccable (claridad y revisión responsive) y UI UX Pro Max (jerarquía, contraste y tablas móviles).

## Copia del diseño anterior

Etiqueta: `backup/lo-pagado-20260926`.

Commit de referencia: `b709a4165e77e5c7efb9e8411010c93744d6154e`, correspondiente a `origin/main` antes de publicar este diseño. Incluye las actualizaciones de Alianzas y Educación que ya estaban en main.

También existe un ZIP local en `output/cobranza-audit-2026-09-26/diseno-publico-anterior.zip`. La etiqueta remota es el respaldo compartido; el ZIP no se versiona.

## Restauración del diseño

Crear una rama desde el main actualizado y restaurar únicamente los cuatro archivos que conectaban la vista anterior. No restablecer todo el repositorio a la etiqueta: eso eliminaría cambios posteriores de otros módulos.

```powershell
git fetch origin
git switch -c codex/restaurar-estado-cuenta origin/main
git restore --source=backup/lo-pagado-20260926 -- 'app/p/lo-pagado/[token]/page.tsx' 'features/clientes/components/PublicLoPagadoActions.client.tsx' 'features/clientes/components/MissingCobroClaimPanel.client.tsx' 'features/payments/components/ManualPaymentModal.client.tsx'
git diff --stat
git diff
```

Revisar el diff antes de confirmar: si esos componentes compartidos recibieron mejoras después de esta entrega, conservarlas al recuperar el diseño. Los nuevos componentes `PublicAccountHeader`, `PublicAccountStatement`, `PublicDailySpendChart` y `PublicMissingPaymentReport` pueden quedar sin referencias; no es necesario borrarlos para recuperar la vista anterior. Las mejoras de filtrado por mes en los servicios son compatibles con la vista anterior y no se restauran.

Validar la vista en escritorio y móvil, ejecutar los checks aplicables y publicar la restauración como un commit normal. Nunca utilizar un push forzado ni revertir el merge de los cambios de compañeros.

## Validación de esta entrega

- TypeScript de la ruta y sus dependencias, lint focalizado y revisión de espacios del diff.
- Snapshot mensual existente: mismos cálculos de cargos, pagos aplicados y deuda.
- Vista con componentes reales y datos ficticios en 320, 390, 768, 1280 y 1920 px, sin desbordamiento horizontal.
- Cabecera: columnas alineadas con gráfico/historial. Reporte de comprobantes debajo del historial, en una única instancia y con campos apilados en escritorio y móvil.
- Gráfico: selección por fecha y teclado, importes diarios/acumulados, barras vacías con altura cero y gasto posterior al corte marcado como pendiente de actualizar.
- Gráfico móvil: área táctil de 44 px por día, desplazamiento interno, fechas legibles y columna seleccionada visible; en escritorio amplio se conserva la vista completa. Inicio/Fin mantienen la selección aunque el desplazamiento pase otras columnas bajo el ratón.
- Interacción con puntero: entrada en columna actualiza importes sin clic; salida restaura totales, incluso con foco en la columna. Los eventos táctiles de salida conservan la selección.
- Estados sin movimientos, saldo a favor, comprobante en revisión y error de lectura de actividad.
- Diálogo: monto sugerido, cambio de moneda, reapertura, ciclo de Tab/Shift+Tab, Escape y restauración del foco/fondo.
- Sin transferencias reales ni envío de comprobantes durante la validación.
