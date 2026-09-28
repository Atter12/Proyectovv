---
tipo: decision
tags: [decision, diseno, accesibilidad, color]
fecha: 2026-09-10
estado: vigente
---

# El botón principal va en carbón, no en naranja

## Decisión

El botón de acción principal es **carbón `#17150f` con texto blanco**.

## Por qué no naranja

No es gusto, es contraste medible:

| Combinación | Ratio | ¿Pasa AA? |
|---|---|---|
| Blanco sobre `#ff781f` | **2.6 : 1** | No |
| Blanco sobre `#17150f` | **16 : 1** | Sí, de sobra |

El botón naranja con texto blanco que estuvo meses en producción **era difícil de
leer y nadie lo había notado**. WCAG AA pide 4.5:1 para texto normal.

## La regla que queda

Si en algún momento hace falta un botón naranja, el texto va en **casi negro**,
nunca en blanco. El naranja de marca es un color claro: solo sostiene letra
oscura.

## Qué se descartó

**Oscurecer el naranja** hasta que pasara con texto blanco. Habría hecho falta
llegar cerca de `#8a3d00`, que ya no es el naranja de la marca. Preferimos
mantener el naranja intacto y cambiar el rol del botón.

## Estado

- Implementado en: las cuatro pantallas de acceso
- Pendiente: los botones naranjas del panel siguen con texto blanco

## Enlaces

- [[Diseño — MOC]]
- [[El naranja es acento, no superficie]]
