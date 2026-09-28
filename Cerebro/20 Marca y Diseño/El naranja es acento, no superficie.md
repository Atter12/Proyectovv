---
tipo: decision
tags: [decision, diseno, marca, color]
fecha: 2026-09-10
estado: vigente
---

# El naranja es acento, no superficie

## Decisión

En las pantallas de acceso el naranja de marca aparece en **tres lugares
contados**: el logo, el borde del campo activo y los links. Nada más.

El peso visual lo lleva el blanco, y el pastel sale de una imagen real
(`public/auth/login-side-waves.png`) que llevaba meses en el repo sin que la
usara ninguna pantalla.

## Qué se descartó y por qué

**Naranja repartido en todo**, que era lo que había. Pintaba logo, botones,
links, badges y acentos por igual. Cuando un color lo pinta todo deja de señalar
nada, y eso es lo que hacía que la pantalla se sintiera barata.

**Naranja como bloque grande**, que fue la primera propuesta: media pantalla de
degradado coral a ámbar con la letra en negro. Era coherente con la marca y
resolvía el contraste, pero el cliente lo describió como que «da epilepsia». Un
campo saturado de ese tamaño cansa.

**Tres direcciones genéricas** que se propusieron antes (una tarjeta centrada
tipo Stripe, un degradado oscuro tipo SaaS, y una versión crema con café). El
cliente las rechazó por parecer generadas. La tercera usaba exactamente la
paleta beige más café que es el recurso por defecto de cualquier IA para un
encargo «premium».

## El criterio de fondo

El naranja tiene que **señalar algo**. Si aparece en más de tres sitios, ya no
señala. Y si ocupa una superficie grande, cansa antes de que el usuario termine
de escribir su correo.

## Estado

- Implementado en: `main`, commit `a138a6d`, 10 de septiembre de 2026
- Alcanza a: `/login`, `/register`, `/verify-otp`, `/forgot-password`
- Pendiente: el resto del panel sigue con el naranja repartido

## Enlaces

- [[Diseño — MOC]]
- [[El botón principal va en carbón, no en naranja]]
- [[El login venía de una plantilla de hipotecarias]]
