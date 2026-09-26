---
name: AdsHolistic — asistente de gerencia
description: Superficie de consulta de cartera implementada en modo Operate.
colors:
  canvas: "#fcfbf9"
  brand-mark: "#d47840"
  control-accent: "#a95023"
  border: "#e8e2da"
  muted: "#6c665f"
---

# Asistente de gerencia

Referencia de la implementación aprobada en `/asistente`, para gerentes. Modo Operate: conserva la marca existente y prioriza consultar datos operativos. La página y la API requieren capacidades de staff o superadmin y bloquean el modo «actuar como cliente».

## Alcance y archivos

La consulta abarca la **cartera general**, independientemente del cliente seleccionado en el panel. El compositor y el encabezado de conversación hacen explícito ese alcance. La API recibe únicamente `message` y carga `loadAssistantBrief()` sin un filtro de cliente seleccionado.

La autoridad visual es `OpsAssistant.module.css`; la interacción está en `OpsAssistant.client.tsx`, los reportes en `OpsAssistantReport.tsx` y los iconos en `AssistantIcon.tsx`. El contrato está en `lib/ops/assistant-response.ts`; `assistant-answer.ts` construye respuestas y `assistant-brief.server.ts` reúne los datos. Las rutas de página y API conservan los controles de acceso.

## Marca y jerarquía

Se hereda Sora del panel, cargada en `app/layout.tsx`. El lienzo cálido `#fcfbf9`, las tarjetas blancas y los bordes finos de 1 px `#e8e2da` sostienen una jerarquía tranquila. La «h» usa `#d47840`; el acento de controles accesible `#a95023` distingue envío, enlaces y foco. Conservar esta separación entre marca y controles.

La bienvenida usa un título de 28–42 px, peso 500, y descripción secundaria. El compositor tiene radio de 16 px y sombra ligera; las sugerencias, métricas y tablas usan radios de 12 px. Los iconos locales son trazos de 1.65 px, heredan el color y son decorativos (`aria-hidden`).

## Composición y adaptación

Bienvenida, compositor y conversación están centrados con un máximo de 920 px; la barra superior alcanza 1152 px. La bienvenida presenta cuatro consultas principales: pagos de hoy, recargas y fee, clientes activos y alertas de cartera. Crédito y clientes en rojo aparecen como acciones secundarias.

Desde 541 px, una conversación iniciada ocupa `calc(100dvh - 4rem)`, con mínimo de 620 px. Solo el historial tiene desplazamiento interno; el compositor y las dos sugerencias de consulta permanecen fuera de esa zona. El último turno se lleva a la vista al añadirse.

Hasta 540 px, el contenido fluye verticalmente con el desplazamiento de la página. Las sugerencias pasan a una columna, las métricas se apilan y el compositor queda en el flujo con espacio para el área segura inferior. Las tablas conservan encabezados accesibles y muestran cada fila como una cuadrícula de etiquetas y valores; no dependen de desplazamiento horizontal.

## Reportes y procedencia

La API devuelve `reply`, `today` y `blocks`. Cada bloque puede contener título, texto, métricas, tabla con caption y fuentes desplegables. `reply` sirve para copiar y como presentación alternativa cuando no hay bloques. La primera métrica tiene mayor jerarquía y los valores numéricos usan cifras tabulares.

Las fuentes describen los datos realmente utilizados: Hecom · Cobros, Hecom · Gasto de ads, Hecom · Cartera, AdsHolistic · Recargas y AdsHolistic · Pagos manuales, según el reporte. Conservar fechas de corte, moneda, límites de filas y exclusiones de recargas que entregue el servidor.

Los pagos de hoy están **agrupados por cliente**. La métrica cuenta «Clientes con pagos»; no representa una cantidad de transacciones. No agregar cantidades de transacciones, métodos ni horas ficticias a este reporte. El total incluye todos los clientes aunque la tabla muestre solo los primeros 15.

## Interacción y estados

- Enter envía; Shift+Enter inserta una línea. La composición de texto con IME no dispara el envío. El campo tiene etiqueta accesible y límite de 500 caracteres.
- Solo hay una solicitud activa. El envío vacío o durante carga está deshabilitado; los accesos de consulta posterior también se deshabilitan mientras se consulta.
- La carga anuncia su estado; las respuestas anuncian disponibilidad. Errores de conexión, respuestas incompletas y el límite de 60 segundos ofrecen reintento del mismo turno.
- «Nueva consulta» cancela una solicitud activa, vacía el historial y borrador, y devuelve el foco al compositor. Al pasar por primera vez a conversación también se conserva el foco del campo.
- «Copiar respuesta» copia `reply` y comunica éxito o fallo. Las fuentes usan `details`/`summary` nativos y las tablas incluyen caption y encabezados de columna.
- Los controles muestran foco de teclado. El campo señala el foco mediante el borde del compositor. La preferencia de movimiento reducido elimina animaciones y transiciones.

El historial vive únicamente en el estado local del componente; no se persiste. **Cada consulta es independiente**: los turnos anteriores no se envían como contexto a la API. Las sugerencias posteriores abren consultas completas, sin implicar memoria conversacional.
