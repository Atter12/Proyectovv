# Estado de cuenta público: diseño y respaldo

## Alcance

La ruta `/p/lo-pagado/[token]` presenta primero el saldo del mes y el acceso al pago. Conserva el cálculo mensual existente y el flujo de transferencia con comprobante. La confirmación automática con pasarelas se implementará por separado.

El diseño utiliza la marca, tipografía y colores existentes de Holistic. Prioriza lectura, contraste y uso táctil; no añade animaciones decorativas. En escritorio separa saldo y acción en dos columnas; en móvil utiliza una columna y filas para el detalle diario.

## Revisión de diseño

| Before | After | Why |
| --- | --- | --- |
| La acción de pago estaba después de un informe largo. | Saldo, fecha de corte y pago aparecen al inicio. | El cliente entiende cuánto corresponde pagar antes de explorar movimientos. |
| El detalle financiero dominaba la primera vista. | Historial visible y detalle diario/por cuenta desplegable. | Mantiene la información disponible con una jerarquía más clara. |
| El reporte de comprobantes ocupaba una columna estrecha. | Reporte y actividad usan el ancho de la sección. | Facilita completar y revisar información en ambas pantallas. |
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

Revisar el diff antes de confirmar: si esos componentes compartidos recibieron mejoras después de esta entrega, conservarlas al recuperar el diseño. Los nuevos componentes `PublicAccountHeader` y `PublicAccountStatement` pueden quedar sin referencias; no es necesario borrarlos para recuperar la vista anterior. Las mejoras de filtrado por mes en los servicios son compatibles con la vista anterior y no se restauran.

Validar la vista en escritorio y móvil, ejecutar los checks aplicables y publicar la restauración como un commit normal. Nunca utilizar un push forzado ni revertir el merge de los cambios de compañeros.

## Validación de esta entrega

- TypeScript de la ruta y sus dependencias, lint focalizado y revisión de espacios del diff.
- Snapshot mensual existente: mismos cálculos de cargos, pagos aplicados y deuda.
- Vista con componentes reales y datos ficticios en 320, 390, 768 y 1365 px.
- Estados sin movimientos, saldo a favor, comprobante en revisión y error de lectura de actividad.
- Diálogo: monto sugerido, cambio de moneda, reapertura, ciclo de Tab/Shift+Tab, Escape y restauración del foco/fondo.
- Sin transferencias reales ni envío de comprobantes durante la validación.
