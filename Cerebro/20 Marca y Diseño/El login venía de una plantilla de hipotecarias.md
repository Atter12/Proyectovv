---
tipo: nota
tags: [diseno, marca, hallazgo]
fecha: 2026-09-10
---

# El login venía de una plantilla de hipotecarias

El jefe dijo que el login «se veía feo» sin poder explicar por qué. La causa
estaba escrita en el propio código.

**La clase del fondo se llamaba `mortgage-login`.** *Mortgage* es hipoteca. El
fondo crema con manchas durazno salió de una plantilla de fintech hipotecario. Se
sentía visto antes porque literalmente lo era.

```css
.mortgage-login {
  background-color: #f7f4ef;
  background-image: radial-gradient(48% 42% at 6% 8%, rgb(255 176 130 / .38) …
```

## Rompía dos reglas del propio sistema

**Uno.** El comentario que abre `globals.css` define la marca así:

```
/* Holistic mark: coral → orange → amber on black */
```

Coral, naranja y ámbar. **Sobre negro.** El login usaba uno solo de los tres,
aplanado, sobre crema.

**Dos.** Dieciocho líneas más abajo, alguien ya lo había advertido:

```
/* Cool slate — misma paleta que landing / .auth-canvas (no cream) */
```

Dice *no cream*, con todas sus letras. Y el login se fue a crema.

## La lección

Cuando algo «se ve feo» y nadie sabe explicar por qué, conviene buscar la causa
en el código antes de proponer rediseños. El nombre de una clase puede delatar de
dónde salió.

## Enlaces

- [[Diseño — MOC]]
- [[El naranja es acento, no superficie]]
- [[La marca es redonda, así que la tipografía también]]
