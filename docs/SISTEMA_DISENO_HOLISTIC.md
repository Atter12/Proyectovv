# Holistic Marketing — Sistema de diseño (handoff pro)

> **Qué es este documento:** brief de diseño de nivel producción para que otro agente (Cursor) o diseñador/dev **extienda o reimplemente UI** sin reinventar la marca y sin caer en el look genérico de IA.
>
> **Producto:** Holistic Marketing / Ads Holistic (`adsholistic.com`)  
> **Stack UI:** Next.js App Router · Tailwind v4 · CSS variables en `app/globals.css` · landing en `features/landing/techlo-landing.css`  
> **Idioma de UI:** español (formal cercano, ops LATAM: “fondear”, “asignar”, “cuenta ads”).  
> **Actualizado:** 2026-08-07 (tokens sacados del código real).

---

## 0. Prompt listo para pegar en otro Cursor

Copiá y pegá esto al inicio de la conversación:

```
Implementá / rediseñá UI siguiendo EXACTAMENTE el design system de Holistic Marketing
en docs/SISTEMA_DISENO_HOLISTIC.md y los tokens en app/globals.css + features/landing/techlo-landing.css.

Reglas no negociables:
1) Marca naranja Holistic #ff781f (no púrpura/indigo IA).
2) Tema claro corporativo: fondos #faf8f5 / #ffffff / #f4f6f8 — NO dark mode por default.
3) Tipografía: Sora (landing + display del dashboard) + Plus Jakarta Sans (UI app).
4) NO Inter, Roboto, Arial como font principal. NO serif “cream terracotta” broadsheet.
5) NO purple gradients, glow neón, glassmorphism extremo, pills rounded-full en masa, multi-shadow.
6) CTAs = sólido naranja; nav activo = soft peach #fff1e8 + texto deep #e8451a.
7) Cards: blanco, border #ece7e0 o slate suave, radius 12–16px, sombra suave (no neumorfismo).
8) Motion solo opacity/transform, easing cubic-bezier(0.22, 1, 0.36, 1).
9) Preservar logos/assets de Holistic y el acento naranja del mark.
10) Si tocas un módulo existente, leé globals.css y el componente hermano antes de inventar clases nuevas.
```

---

## 1. North star de marca

| Atributo | Definición |
|----------|------------|
| **Personalidad** | Ops de ads seria, limpia, corporativa-cálida. Dinero + TikTok BM + Hecom CRM. |
| **Tono visual** | Claro, aireado, naranja como único heroe de acento. |
| **No es** | SaaS dark-mode purple glow · fintech neón · periódico cream/serif · startup generica Inter-indigo. |
| **Brand test** | Si quitás el logo y el naranja y la UI podría ser “cualquier SaaS AI”, está mal. |

### Propuesta de valor visual en una frase

> **Fondo warm-light + tipografía geométrica (Sora/Jakarta) + un solo acento naranja `#ff781f` con softs peacheados.**

---

## 2. Prohibiciones (anti–AI default look)

**Nunca hacer:**

| Anti-patrón | Por qué |
|-------------|---------|
| Gradientes púrpura → índigo / violet | Cliché IA 2023–25 |
| Fondo cream genérico + serif display + terracotta | Otro clúster IA “warm editorial” |
| Dark mode como primera impresión del producto | Este producto se rediseñó **a light** |
| Glow naranja/violeta, blur-heavy glass | Ruido, nada “Holistic ops” |
| `rounded-full` en todo (pills en clusters) | Aspecto dashboard toy |
| Multi-layer shadows ruidosas | Preferir 1 sombra suave |
| Inter / Roboto / system stack como hero | Diluye marca |
| Cards dentro del hero de marketing | Hero = brand + 1 headline + 1 línea + CTA + visual full-bleed |
| Superposición de badges flotantes sobre media | Clutter |
| Emojis decorativos en UI ops | No encajan con el tono |

**Siempre hacer:**

- Una composición clara por viewport (landing) o un job claro por sección (dashboard).
- Jerarquía: **título denso (stone dark)** → body (muted warm o slate) → CTA naranja.
- Superficies **blancas** sobre **#faf8f5** o **#f4f6f8**.
- Bordes **1px** sutiles, no molduras pesadas.

---

## 3. Paleta canónica (tokens de código)

Fuente de verdad: `app/globals.css` (`:root` / `.light`) y `.techlo-landing` / `.auth-canvas` / `.dashboard-canvas`.

### 3.1 Brand (naranja Holistic)

| Token / nombre | Hex / valor | Uso |
|----------------|-------------|-----|
| **Primary / Accent** | `#ff781f` | CTA, links activos, iconos de énfasis, selection tint |
| **Primary hover / deep** | `#e8451a` · también `#f06a12` en landing hover | Hover de botón, nav active text |
| **Coral (mark)** | `#ff4d2d` | Extremo del gradient de marca |
| **Accent amber** | `#ffa12c` · `#ffb84a` (landing) | Highlight suave, never full-UI |
| **Primary soft** | `#fff1e8` | Fondos de estado activo, badges info, icon wells |
| **Primary ring soft** | `#ffd8bf` / `rgb(255 120 31 / 0.22)` | Focus rings, nav ring |
| **Brand gradient** | `105deg: #ff4d2d → #ff781f → #ffa12c` | Logo mark, raros highlights — **no** backgrounds de página |
| RGB primary | `255 120 31` | Construir `rgb(... / alpha)` |

### 3.2 Superficies (tema light de producto)

| Rol | Hex | Dónde |
|-----|-----|--------|
| Canvas warm | `#faf8f5` | Auth, shell dashboard (`.dashboard-canvas`, `.auth-canvas`) |
| Canvas cool gray | `#f4f6f8` | `--background` / admin bg legado |
| Surface | `#ffffff` | Cards, sidebar, paneles |
| Soft surface | `#f8fafc` · o elevated `#faf8f5` | Rows hover, table head, nested wells |
| Gradiente de página app | `linear 180deg #fff → #faf8f5 → #f5f2ed` + radial naranja `6–9%` arriba | Atmósfera sutil, no wallpaper |

### 3.3 Texto

| Rol | Hex | Notas |
|-----|-----|--------|
| Ink strong | `#1c1917` (warm) o `#0f172a` (slate admin) | Títulos |
| Body warm | `#5c564e` | Body landing/auth/dashboard warm |
| Muted / soft | `#8a8177` · `#94a3b8` (slate) | Meta, labels |
| Nav idle | `#475569` | Links sidebar no activos |

### 3.4 Bordes y divisores

| Rol | Hex |
|-----|-----|
| Warm border (producto rediseñado) | `#ece7e0` · inputs `#e0d9d0` / hover `#cfc6bb` |
| Cool border (admin/tokens slate) | `#e2e8f0` · strong `#cbd5e1` |
| Content border | `#e5eaf0` |

### 3.5 Semánticos (estados)

| Estado | Text / fill | Soft bg |
|--------|-------------|---------|
| Success | `#16a34a` / `#047857` | `#ecfdf5` |
| Warning | `#d97706` / `#b45309` | `#fffbeb` |
| Danger | `#dc2626` / `#b91c1c` | `#fef2f2` |
| Info (marca) | = primary | `#fff1e8` |

### 3.6 Sombras (suaves, una capa mental)

```css
/* Card typical */
box-shadow: 0 20px 40px -28px rgb(28 25 23 / 0.16~0.22);

/* Admin card */
--admin-shadow-2: 0 1px 3px rgb(15 23 42 / 0.05), 0 8px 24px rgb(15 23 42 / 0.04);

/* CTA primary glow (landing only, controlado) */
box-shadow: 0 10px 24px -12px rgb(255 120 31 / 0.55);
```

### 3.7 Radios

| Elemento | Valor |
|----------|--------|
| Control / input | `8px` (`--admin-radius-input`) |
| Botones landing | `0.5rem` (8px) |
| Card dashboard / auth panel | `1rem` (16px) / `--admin-radius-panel: 16px` |
| Card admin | `12px` |
| Icon well | `~0.85rem` |
| **Evitar** | `9999px` en botones primarios (salvo chips de estado muy chicos) |

---

## 4. Tipografía

### 4.1 Familias (cargadas en `app/layout.tsx`)

| Fuente | Variable CSS | Uso |
|--------|--------------|-----|
| **Plus Jakarta Sans** | `--font-jakarta` | Default body App: `body`, form controls, muchos textos UI |
| **Sora** | `--font-sora` | Landing (`.techlo-landing`), display en auth/dashboard (h1–h3, `.font-display`) |

```ts
// pesos
Plus_Jakarta_Sans: 400, 500, 600, 700
Sora: 400, 500, 700
```

**Fallback:** `ui-sans-serif, system-ui, sans-serif` — no Inter como marca.

### 4.2 Escala y ritmo

| Estilo | Reglas |
|--------|--------|
| **Display LG** | `clamp(2.25rem, 1rem + 4vw, 4.25rem)` · weight 700 · `letter-spacing: -0.03em` · lh ~1.12 · color ink |
| **Display MD** | `clamp(1.85rem, 1rem + 2.6vw, 3rem)` |
| **H3 / card title** | ~1.25rem · 700 · tracking -0.02em |
| **Eyebrow** | 0.78rem · 700 · `letter-spacing: 0.18em` · uppercase · color **primary** |
| **Body** | lh ~1.6–1.8 en marketing; app ~1.5 |
| **Feature settings** | `"ss01" on, "cv11" on` en body/Jakarta |
| **Selection** | `background: rgb(255 120 31 / 0.28); color: #141210` |

### 4.3 Copy UI

- Español neutro LATAM, imperativos claros: “Asignar”, “Fondear”, “Ir a…”.
- Evitar marketing fluff dentro del dashboard.
- Labels uppercase pequeños solo para KPIs / col headers de tabla (tracking amplio, muted).

---

## 5. Superficies del producto (3 capas)

### 5.1 Marketing / Landing (`.techlo-landing`)

**Archivo:** `features/landing/techlo-landing.css`

| Token local | Valor |
|-------------|-------|
| `--tl-primary` | `#ff781f` |
| `--tl-primary-hover` | `#f06a12` |
| `--tl-primary-soft` | `#fff1e8` |
| `--tl-theme-light` | `#faf8f5` |
| `--tl-nav-dark` | `#121110` (nav ancla logo) |
| `--tl-body` | `#ffffff` |
| `--tl-dark` / text / muted / border | `#1c1917` / `#5c564e` / `#8a8177` / `#ece7e0` |
| Container | max `1320px`, padding 1.25–1.75rem |
| Section pad | 4.5rem → 6rem desktop |

**Patrones:**

- Hero: radial soft naranja arriba + blanco; **brand fuerte** + un H1 + una oración + grupo CTA.
- Botón primary sólido naranja + sombra naranja controlada; secondary white + border.
- Cards de servicio: white, border, hover `translateY(-4px)` + border naranja 40% + shadow.
- Motion: scroll reveal **solo opacity + transform** (sin blur), `600ms`, easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- Nav puede ser oscuro (#121110) para anclar el logo naranja; el **resto de la página es clara**.

### 5.2 Auth / login (`.auth-canvas`)

**Patrones actuales del rediseño light:**

- Background: radial naranja 8% + gradient white → `#faf8f5` → `#f5f2ed`.
- Panel: white, `border-radius: 1rem`, border `#ece7e0`, shadow suave.
- **No** reintroducir el canvas luxury dark salvo pantallas legacy que aún no migraron (`.auth-luxury-canvas` es legado).

### 5.3 Dashboard app (`.dashboard-canvas` + shell)

| Pieza | Tratamiento |
|-------|-------------|
| Canvas | Warm `#faf8f5` + mismo radial/gradient sutil |
| Sidebar rail | Blanco, border-right `#ece7e0`, sombra lateral suave |
| Nav item idle | texto `#475569` / muted |
| Nav **activo** | bg `#fff1e8`, texto `#e8451a`, ring peach (no filled bar neón) |
| Topbar | claro, semi transparent ok (`#f8fafc` 92%) |
| Cards / KPI | white, border, radius 16px |
| Botón principal de acción | naranja sólido, texto blanco |
| Botón secundario | white + border |
| Badges rol (GERENTE / SUPER ADMIN) | compactos, high contrast, sin competir con logo |
| Empty states | mensaje claro + un CTA naranja; sin ilustraciones genéricas clutter |

**Componentes de referencia en código:**

- Layout: `app/(dashboard)/layout.tsx`, `components/layout/*`
- Nav: `DashboardNavLinks`, topbar, `SidebarWalletCard`
- Pagos (referencia de densidad ops): `features/payments/components/PaymentsGatewayPanel.tsx`
- CSS: `app/globals.css` (bloques `.dashboard-*`, `.auth-canvas`, admin tokens)

---

## 6. Componentes — recetas

### 6.1 Botón primaria

```
bg: #ff781f
hover: #e8451a or #f06a12
text: #fff
radius: 8px (app) / 0.5rem (landing)
padding: ~12–16px vertical, 20–24px horizontal
font-weight: 500–700
transition: transform 0.2s, background 0.2s
active: translateY(1px)
shadow CTA (opcional): 0 10px 24px -12px rgb(255 120 31 / 0.55)
```

### 6.2 Botón secundaria / ghost

```
bg: #fff
border: 1px solid #ece7e0
text: #1c1917
hover: border/text primary #ff781f o bg #fff7f0
```

### 6.3 Card de contenido

```
bg: #fff
border: 1px solid #ece7e0
radius: 1rem
shadow: 0 20px 40px -28px rgb(28 25 23 / 0.16)
padding: 1.25–1.5rem
```

### 6.4 KPI strip (Resumen)

- 4 celdas en fila: label uppercase soft + valor grande ink + nota auxiliar muted.
- **No** cards con 4 sombras distintas; misma card system.
- En modo BM, helper “No se usa en modo BM” en muted — no es error.

### 6.5 Tabla ops (Asignar / cuentas)

- Head: fondo soft slate/warm transparente 85%.
- Status pill: naranja suave “Activa” (no rainbow badge mess).
- Acciones: links texto **negrita** “Asignar” + secundario understated “Cambiar ID…”.
- Preferir densidad legible a tabla “enterprise densa 11px ilegible”.

### 6.6 Alertas

| Tipo | UI |
|------|----|
| Warning operacional | bg `#fffbeb`, border amber, texto `#b45309` — ej. “No hay cuentas Aprobadas…” |
| Info de flujo | soft peach + primary text |
| Error | danger soft |

### 6.7 Inputs

```
bg: #fff
border: #e0d9d0 (warm) o #e2e8f0 (cool)
hover border: #cfc6bb
focus: ring rgb(255 120 31 / 0.22)
radius: 8px
```

---

## 7. Layout y grid

| Contexto | Regla |
|----------|--------|
| Landing container | max **1320px**, centrado |
| Dashboard content | padding generoso, no “edge crush”; una columna de trabajo principal |
| Sidebar | rail fijo blanco; usuario/cliente seleccionado arriba (avatar initials, “OPERANDO”) |
| Mobile | mismo sistema; stack vertical; CTAs full-width en auth; nav colapable si ya existe pattern |
| Landing hero | full-bleed visual plane; **no** media card inset tipo mock en card flotante salvo sistema legacy |

---

## 8. Motion

| Item | Spec |
|------|------|
| Easing firma | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Reveal default | 600ms, distance ~1.5rem Y |
| Auth panel enter | 420ms, translateY 10px + opacity |
| Hover cards | 250ms transform + shadow |
| **Prohibido** | blur animado, bounce exagerado, parallax pesado, loop confetti |

Ship 2–3 motions intencionales en piezas de marketing; en dashboard, hovers mínimos y loading sobrio.

---

## 9. Iconografía e imagen

- Iconos: stroke limpio, tamaño 20–24 en nav; wells de icono con fondo `#fff1e8` y glyph naranja deep.
- Logo: assets del repo (`/public` favicon/logo Holistic) — **no** regenerar logo con IA.
- Fotografía de landing: producto/contexto real preferido; fondos abstractos solo como velo radial de marca, no como “el producto”.

---

## 10. Roles y densidad de UI (contexto de producto)

Referencia de negocio: `docs/MAPA_DISENO_ROLES.md`.

| Persona | Implicación de diseño |
|---------|------------------------|
| **Cliente** | Flujo Stripe/cartera; menos nav (sin CRM global); copy de “tu cuenta”. |
| **Gerente** | Ops densas; fondeo **cash BM**; selector de cliente; tabla Asignar. |
| **Super Admin** | Dual path Stripe | BM; más controles; misma estética, más herramientas. |

No cambiar colores por rol: **misma skin**, distinto contenido y CTAs.

---

## 11. Dark mode

Existen tokens `.dark` en `globals.css` por compatibilidad.

**Directiva de rediseño actual:**  
- Producto y marketing se entregan **light-first**.  
- No redesñar pantallas nuevas partiendo de dark.  
- Si tocás dark, mantener primary naranja y la misma tipografía; no inventar palette púrpura.

---

## 12. Archivos fuente de verdad (orden de lectura)

1. Este doc: `docs/SISTEMA_DISENO_HOLISTIC.md`
2. `app/globals.css` — tokens brand, admin, auth, dashboard
3. `features/landing/techlo-landing.css` — landing
4. `app/layout.tsx` — fonts Sora + Jakarta
5. Componentes layout dashboard en `components/layout/`
6. Módulo referencia de polish: `features/payments/…`, overview/clientes
7. Roles: `docs/MAPA_DISENO_ROLES.md`

**Regla de implementación:**  
preferí **CSS variables existentes** (`var(--admin-accent)`, `var(--auth-border)`, clases `.dashboard-*`) sobre hex hardcodeados nuevos. Si hardcodeás, usá los hex de la tabla §3.

---

## 13. Checklist de QA visual (antes de merge)

- [ ] El acento dominante es `#ff781f`, no otro color de sistema.
- [ ] No hay purple/indigo gradient theme.
- [ ] Fondos claros warm/cool; no pantalla full black de “AI dark SaaS”.
- [ ] Fonts = Sora y/o Jakarta (inspeccionar computed).
- [ ] CTA primario sólido naranja; secundario outline white.
- [ ] Nav activo peach + deep orange text.
- [ ] Cards blancas, borde 1px, radius 12–16, sombra una sola “familia”.
- [ ] Tablas y empty states legibles en español.
- [ ] Mobile: no overflow-x; CTA tocable ≥ ~44px alto.
- [ ] Logos Holistic intactos.
- [ ] Coherente con shell adyacente (no un “mini tema” aislado en una página).

---

## 14. Mini snippet de tokens (copiar a un `:root` de sandbox)

```css
:root {
  --hm-primary: #ff781f;
  --hm-primary-hover: #e8451a;
  --hm-primary-soft: #fff1e8;
  --hm-coral: #ff4d2d;
  --hm-amber: #ffa12c;

  --hm-canvas: #faf8f5;
  --hm-canvas-cool: #f4f6f8;
  --hm-surface: #ffffff;
  --hm-border: #ece7e0;
  --hm-border-cool: #e2e8f0;

  --hm-ink: #1c1917;
  --hm-body: #5c564e;
  --hm-muted: #8a8177;

  --hm-success: #16a34a;
  --hm-warning: #d97706;
  --hm-danger: #dc2626;

  --hm-radius-sm: 8px;
  --hm-radius-md: 12px;
  --hm-radius-lg: 16px;

  --hm-font-ui: var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
  --hm-font-display: var(--font-sora), var(--font-jakarta), ui-sans-serif, system-ui, sans-serif;
  --hm-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
```

---

## 15. Qué “no” documentar como marca

- WhatsApp / chat bubbles flotantes de terceros: no son marca Holistic.
- Onboarding chips tipo “2/3 Empieza con Default”: UI de proveedor; no copiar su estilo al design system.
- Emails legacy con Inter/dark: no son el look web actual salvo que se diga lo contrario al rehacer templates.

---

## 16. Resumen de una línea

> **Holistic = light warm ops UI, Sora + Jakarta, un naranja `#ff781f`, peachs `#fff1e8`, bordes `#ece7e0`, cards blancas, zero purple AI, zero dark-first.**

Usá este archivo + los CSS citados como contrato. Ante duda de color, **gana el token del código sobre la memoria del modelo.**
