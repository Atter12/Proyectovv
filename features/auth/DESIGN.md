---
name: AdsHolistic — acceso
description: Login OTP implementado en modo Operate.
colors:
  canvas: "#fcfbf9"
  text: "#24211e"
  muted: "#69625c"
  border: "#ddd9d4"
  action: "#ff781f"
  action-hover: "#f56a0b"
  link: "#b94708"
  link-hover: "#923707"
typography:
  heading:
    fontFamily: "var(--font-jakarta), sans-serif"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.035em"
rounded:
  control: "10px"
  notice: "12px"
  image: "24px"
spacing:
  form-gap: "20px"
  page-inset: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
---

# Diseño de autenticación

## Overview

Acceso directo al panel mediante correo y código: título «Entra a AdsHolistic.», explicación breve y acción «Recibir código». El lienzo cálido, la tipografía oscura y el naranja conectan formulario e imagen. El mensaje de negocio se limita a «Recarga en soles. Pauta en dólares.».

Esta referencia describe la implementación aprobada. La autoridad está en `components/AuthSplitShell.tsx`, `components/auth.module.css`, `components/LoginForm.client.tsx` y `app/(auth)/login/page.tsx`. Capturas de referencia: `.impeccable/review/desktop.png` (1588 × 992) y `mobile.png` (390 × 844), relativas a la raíz.

## Colors

El naranja vivo identifica la acción principal con texto oscuro. El naranja profundo distingue enlaces y foco. Fondo marfil, bordes cálidos y texto secundario gris mantienen una jerarquía tranquila. Los valores del frontmatter corresponden a la apariencia actual; el módulo de autenticación prevalece sobre las bases globales.

## Typography

Plus Jakarta Sans, cargada mediante `--font-jakarta`. El título del login usa `clamp(28px, 8.8cqw, 50px)`; desde 1440 px cambia a `clamp(40px, 10cqw, 56px)`. La descripción crece de 16 a 18 y 22 px en los cortes de 1280 y 1440 px. Etiquetas seminegritas; controles de 16, 16 y 20 px respectivamente.

## Layout

Desde 1024 px: dos columnas de `0.52fr` y `0.48fr`, margen y separación de 24 px. El panel visual permanece adherido a 24 px del borde superior, usa altura `calc(100dvh - 48px)`, máximo `calc((100vw - 72px) * .65)` y mínimo de altura cero, sin proporción fija. El límite por ancho evita recortar los teléfonos en escritorios estrechos. Su contenido interior lleva 28 px verticales y 32 px horizontales; desde 1280 px, 32 y 40 px. Desde 1440 px la separación entre columnas es de 40 px. Formulario centrado, ancho máximo de 580 px y pie inferior. En login, la invitación y el enlace «Crear cuenta» se centran debajo del formulario y su botón principal, tanto en escritorio como en móvil (`accountLinkPosition="bottom"`). Los demás flujos conservan el enlace en la navegación superior, posición predeterminada del shell.

En móvil se oculta el panel visual y el logo pasa a la cabecera. En login, el texto previo a «Crear cuenta» permanece visible debajo del formulario; cuando el enlace está en la cabecera, ese texto aparece desde 640 px. Márgenes de 24 px, reducidos a 20 px bajo 375 px. Altura de campos y CTA: 56 px; 64 px desde 1280 px y 72 px desde 1440 px.

## Elevation & Depth

Formulario plano, sin tarjeta ni sombra estructural. La profundidad procede de la fotografía. El foco del campo añade borde naranja y halo de 3 px; enlaces y botones muestran contorno de teclado de 2 px, separado 4 px.

## Shapes

Controles rectangulares suavizados; avisos y recuperación ligeramente más redondeados. El panel de imagen recorta sus esquinas. Usar los radios del frontmatter para mantener coherencia.

## Components

Imagen decorativa definitiva: `public/auth/holistic-studio-access-square.png` (1254 × 1254), composición de estudio con una «h» naranja y dos teléfonos, con fondo libre alrededor. Ajuste `cover`, posición `50% 50%` y texto alternativo vacío; el encuadre es común a todos los flujos, sin ajustes por ruta. La logomarca independiente `public/brand/holistic-marketing-logo.png` enlaza al inicio; no reemplazarla por texto. En el panel visual ocupa el 25 % del ancho interior disponible, con mínimo de 120 px y máximo de 180 px.

Conservar validación nativa de correo, envío OTP, estado «Enviando código…», controles deshabilitados durante envío y errores accesibles. La recuperación de correo se despliega por nombre, permite seleccionar resultados y mantiene estados de búsqueda, vacío y error. Preservar la variante por contraseña y las rutas según configuración, incluido Clerk.

El shell y los estilos también sirven a registro, verificación OTP y recuperación; los ajustes del encabezado de login son específicos. Mantener navegación por teclado, enlace «Ir al formulario», avisos `alert`/`status`, entrada OTP nativa y preferencias de movimiento reducido. Cualquier cambio compartido requiere comprobar estas pantallas.

## Do's and Don'ts

- Mantener una acción principal visible y la separación entre decoración y formulario.
- Conservar los activos aprobados y el comportamiento adaptable.
- Documentar decisiones visuales sin añadir promesas comerciales ni datos de usuarios.
