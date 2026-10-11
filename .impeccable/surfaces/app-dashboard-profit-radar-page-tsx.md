---
version: 1
slug: "app-dashboard-profit-radar-page-tsx"
primary_target: "app/(dashboard)/profit/radar/page.tsx"
related_targets: ["features/profit/radar"]
---

# Profit › Radar (arranque y rondas de videos)

Mode: operate. Audience: vendedor pequeño en Perú, en computadora, revisando su Profit; staff en "ver como cliente". Task: confirmar rubro, productos, quién sale en cámara y objetivo; reaccionar a ~12 videos de su rubro; elegir referencias entre ~8 más cercanas a su gusto. Constraints: receta, no copia; nada de un cliente se muestra a otro; reproductor oficial de TikTok, sin descargar; si un video muere se reemplaza en silencio; trato de tú; naranja solo como acento, botón principal carbón.

## Direction contract

THESIS: El arranque del Radar es una conversación con Profit, no un formulario ni un feed: Profit propone lo que ya sabe del cliente y el cliente confirma o corrige con un toque. Rechaza el asistente de pasos con barra de progreso y el muro de videos tipo TikTok.

OWN-WORLD: El mundo de Ads Holistic intacto: lienzo cálido #faf8f5, tarjetas blancas con borde #ece7e0, tinta #1c1917, cuerpo #5c564e, Plus Jakarta Sans en títulos y texto (Sora quedó fuera: contradice el logo redondo, nota de Cerebro). Mensajes de Profit en tarjeta blanca; respuestas del cliente en burbuja carbón #17150f. Naranja solo en tres lugares: chip recién aprendido (#fff1e8 / #9a3412), anillo de foco y el avance de la ronda.

STORY: El cliente entiende que Profit ya lo conoce, confirma en segundos, ve videos reales que hoy funcionan en su rubro, marca lo que haría a su manera y ve cómo su perfil se arma solo arriba.

FIRST VIEWPORT: Encabezado de Profit con selector Análisis · Radar a la derecha. Debajo, fija, la línea "Tu perfil" con chips. Columna central de 760px: primer mensaje de Profit con el resumen del negocio y los rubros como chips (el sugerido marcado), y la acción principal carbón "Sí, es eso".

FORM: Conversación guiada; estructura 5 de mi lista ordenada; seed e4107d22. Signature move: cada respuesta se condensa en un chip que entra a la línea "Tu perfil"; lo aprendido de los videos entra tintado de naranja suave.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
