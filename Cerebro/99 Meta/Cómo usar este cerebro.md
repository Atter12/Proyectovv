---
tipo: meta
tags: [meta, convenciones]
---

# Cómo usar este cerebro

Vault de **Ads Holistic**, creado el 2026-09-10 en `C:\adsholistic\Cerebro`.

## Abrirlo

Obsidian lo lista en el selector de almacenes (icono inferior izquierdo). Si no
aparece: **Abrir carpeta como almacén** y elegir esa ruta.

El vault es esta carpeta, **no** la raíz del proyecto. Es a propósito: una raíz
con `node_modules` tiene decenas de miles de archivos y Obsidian se arrastraría
al indexarlos.

## Convenciones

**Los MOC son la columna vertebral.** Cada área tiene uno (`— MOC`) y toda nota
nueva se enlaza desde el suyo. Una nota sin enlace entrante está perdida.

**Una nota, una idea.** Si el título necesita una «y», probablemente son dos notas.

**Los títulos son afirmaciones, no etiquetas.** «El crema de acceso no es el del
landing» dice más que «Colores de auth».

**Frontmatter mínimo:** `tipo` (`mapa` · `nota` · `decision` · `recurso` ·
`informe` · `diario` · `meta`) y `tags`. Nada más salvo que sirva para filtrar.

**Las decisiones registran lo descartado.** Si solo se anota lo elegido, dentro de
tres meses se vuelve a discutir lo mismo.

## Cómo se enlaza al proyecto

Los archivos de fuera del vault se enlazan con rutas `file:///…`, que los abren
con la aplicación por defecto del sistema. No son wikilinks: no aparecen en el
grafo ni en los backlinks.

> [!tip] Si se quiere integración completa
> Se pueden montar carpetas del proyecto **dentro** del vault con junctions de
> Windows (`mklink /J`), ignoradas por git. A partir de ahí sí funcionan los
> wikilinks, la búsqueda y las imágenes incrustadas. La contrapartida: borrar la
> junction con una herramienta que la siga borra el contenido real.

## Mantenimiento

- **Semanal:** vaciar [[Bandeja de entrada]]
- **Trimestral:** abrir el grafo (`Ctrl+G`) y buscar notas huérfanas

## Qué NO va aquí

Credenciales, tokens, claves de API ni `.env`. El vault vive dentro del repo y se
commitea. Los secretos se quedan donde ya están.

← [[Inicio]] · [[Estructura del vault]]
