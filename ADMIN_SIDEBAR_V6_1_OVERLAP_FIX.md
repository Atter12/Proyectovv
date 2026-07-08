# Admin Sidebar V6.1 - Overlap Fix

Se corrigió la superposición del texto del CTA inferior `Revisar pagos` sobre las opciones del módulo Sistema.

## Cambios aplicados

- El área de navegación ahora usa `admin-nav-scroll` con `overflow-y-auto`.
- El CTA inferior quedó separado como elemento `shrink-0`, fuera del flujo scrollable del menú.
- El shell 3D mantiene `overflow: hidden` para que el scroll interno no invada el CTA.
- Se añadió un fade superior sutil al CTA para separar visualmente el cierre del menú.
- Se ocultan scrollbars internas para mantener el look premium.

## Resultado

El sidebar conserva el efecto CSS 3D + microinteracciones, pero el menú ya no se cruza visualmente con la acción rápida inferior.
