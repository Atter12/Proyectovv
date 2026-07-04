# Default Media — Contexto del proyecto `web-base`

Documento de referencia actualizado para desarrollo con IA, onboarding de equipo y continuidad del panel publicitario mock.

---

## 1. Resumen ejecutivo

**web-base** es un frontend en **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4** que simula un panel publicitario SaaS/adtech ficticio llamado **Default Media**.

| Aspecto | Estado actual |
|---|---|
| Backend / API de negocio | No implementado — datos mock vía `services/*.mock.service.ts` |
| Auth API (BFF) | **Implementada** — `app/api/auth/*` con sesión mock |
| OAuth / auth real | No — login mock con sesión segura (cookie firmada) |
| Protección de rutas | **Implementada** — `middleware.ts` + guards server-side |
| Base de datos | No |
| Modo | Mock visual completo, compilable, responsive y con controles de acceso |
| Deploy | Vercel (`NEXT_PUBLIC_APP_URL` + `SESSION_SECRET` obligatorios en producción) |
| Marca ficticia | **Default Media** |
| Usuario mock | **Sandro Wong Mera** (`sandro.wong@defaultmedia.mock`) |
| Rol mock | `advertiser` (todos los permisos del panel) |
| Billetera mock | **Cartera Default** — saldo `$0 USD` |

### Flujo principal del producto

```
/  → redirect /login
/login (público)
    ↓ POST /api/auth/login → cookie HttpOnly dm_session
/overview — resumen, cartera, métricas, onboarding  [requiere sesión]
    ↓
/ad-accounts — gestión de cuentas publicitarias      [permiso: adAccounts:read]
/payments — cartera, pasarelas, asignación de saldo  [permiso: payments:read]
/affiliates — programa de referidos y banners        [permiso: affiliates:read]
/creative-analyzer — análisis creativo con IA (mock) [permiso: creativeAnalyzer:read]

POST /api/auth/logout → elimina sesión → /login
```

---

## 2. Stack tecnológico

| Tecnología | Versión |
|---|---|
| Next.js | 16.2.10 |
| React | 19.2.4 |
| TypeScript | ^5 |
| Tailwind CSS | ^4 |
| ESLint | eslint-config-next 16.2.10 |

### Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run start    # Servidor de producción
npm run lint     # ESLint
```

### Alias de imports

- `@/*` → raíz del proyecto (`tsconfig.json`)

### Fuentes

- **Geist Sans** y **Geist Mono** vía `next/font/google` en `app/layout.tsx` (self-hosted en build)

### Variables de entorno

Ver `.env.example`. Variables clave:

| Variable | Ámbito | Descripción |
|---|---|---|
| `AUTH_MODE` | Server | `mock` (actual) \| `oauth` (futuro) |
| `SESSION_SECRET` | Server | Firma de cookies — **obligatorio en producción** (Vercel: Settings → Environment Variables + redeploy) |
| `NEXT_PUBLIC_APP_URL` | Client | URL pública de la app |
| `NEXT_PUBLIC_AUTH_MODE` | Client | Modo de auth visible al cliente |
| `API_BASE_URL` | Server | Backend privado (futuro) |
| `API_KEY` | Server | Clave API backend (futuro) |

---

## 3. Identidad y configuración global

### `config/site.ts`

```ts
name: "Default Media"
walletName: "Cartera Default"
companyName: "Default Media"
description: "Panel publicitario — cartera, cuentas, pagos y afiliados"
```

### `config/routes.ts`

| Constante | Ruta |
|---|---|
| `home` | `/` → redirige a `/login` |
| `login` | `/login` |
| `overview` | `/overview` |
| `adAccounts` | `/ad-accounts` |
| `payments` | `/payments` |
| `affiliates` | `/affiliates` |
| `creativeAnalyzer` | `/creative-analyzer` |
| `api.auth.login` | `/api/auth/login` |
| `api.auth.logout` | `/api/auth/logout` |
| `api.auth.session` | `/api/auth/session` |

### `config/auth.ts`

| Constante | Descripción |
|---|---|
| `protectedRoutes` | Rutas del dashboard que requieren sesión |
| `authRoutes` | Rutas pre-sesión (`/login`) |
| `SESSION_COOKIE_NAME` | `dm_session` |
| `SESSION_MAX_AGE_SECONDS` | 7 días |

### Navegación sidebar (`config/navigation.ts`)

1. Descripción general → `/overview`
2. Mis cuentas publicitarias → `/ad-accounts`
3. Pago → `/payments`
4. Programa de afiliados → `/affiliates`
5. Analizador creativo → `/creative-analyzer`

---

## 4. Arquitectura

### Principios

- **Server Components por defecto** en `page.tsx`, layouts y componentes visuales sin interacción.
- **`"use client"`** solo donde hay estado, tabs, filtros, modales, clipboard, sidebar móvil o widgets flotantes.
- **Composición server/client** — tablas, stats y contenido estático en `page.tsx` (server); toolbars y navegación en client mínimos. Filtros y tabs sincronizados vía **URL** (`searchParams`).
- **Lazy load** — `dynamic(..., { ssr: false })` para `FloatingSupportStack` y modales pesados (`CreateAdAccountModal`, `AddBalanceModal`).
- **Eventos de modal** — `lib/events/modal-events.ts` permite abrir modales desde Server Components sin callbacks server→client.
- **Datos mock** en `mocks/` consumidos por `services/*.mock.service.ts` que devuelven `Promise` (listos para reemplazar por `fetch` server-side).
- **BFF de auth** en `app/api/auth/*` — Client Components llaman `/api` interna, nunca al backend privado directo.
- **Sesión mock real** — cookie `HttpOnly` firmada con HMAC-SHA256 (Web Crypto, compatible Edge).
- **Sin dependencias extra** (no lucide-react, no librerías de charts, no Zod aún).

### Capas

```
app/                    → Rutas, layouts, composición de páginas
app/api/                → BFF (auth mock; futuro: wallet, cuentas, pagos)
middleware.ts           → Protección coarse-grained de rutas
components/ui/          → Primitivos reutilizables
components/layout/      → DashboardShell, Sidebar, Topbar
components/feedback/    → EmptyState, InfoAlert
components/floating/    → Stack de soporte (WhatsApp, chat, onboarding)
features/<módulo>/      → Componentes de negocio por dominio
lib/auth/               → Sesión, guards, permisos, token firmado
lib/env/                → env.server.ts, env.client.ts
lib/api/                → api-client.client.ts, api-client.server.ts
lib/filter/             → Filtros server-side (ad-accounts, payment-accounts)
lib/events/             → Eventos custom para modales (client)
lib/search-params.ts    → Parser de searchParams en páginas server
mocks/                  → Datos ficticios globales
services/               → Capa async mock (simula API de negocio)
types/                  → Contratos TypeScript (incl. auth.ts)
config/                 → Site, rutas, navegación, auth
lib/                    → cn, formatMoney, formatNumber
```

> **Nota `cn()`:** concatena clases sin `tailwind-merge`. Evitar conflictos (ej. no mezclar `w-full` y `w-64` en el mismo componente).

### Separación de responsabilidades (seguridad)

| Capa | Responsabilidad |
|---|---|
| `middleware.ts` | Redirige sin sesión a `/login`; redirige con sesión fuera de `/login` |
| `lib/auth/guards.server.ts` | `requireSession`, `requireRole`, `requirePermission`, `requireCompanyAccess` |
| `page.tsx` (dashboard) | Valida permisos por vista antes de cargar datos |
| `(dashboard)/layout.tsx` | `requireSession()` + pasa `user` y `wallet` al shell (no mocks en client) |
| `app/api/*` | Valida sesión, payload y permisos antes de mutar (futuro) |
| Client Components | Solo UX — ocultar botones; **no es seguridad real** |

---

## 5. Estructura de rutas (`app/`)

```
app/
├── layout.tsx                 # Root layout (lang="es", metadata Default Media)
├── page.tsx                   # Redirect → /login
├── error.tsx                  # Error global — mensaje genérico, sin stack trace
├── not-found.tsx              # 404 profesional
├── globals.css                # Tailwind + animaciones (float-scale, pulse-soft)
├── api/
│   └── auth/
│       ├── login/route.ts     # POST — crea sesión mock + cookie
│       ├── logout/route.ts    # POST — elimina cookie
│       └── session/route.ts   # GET — consulta sesión actual
├── (auth)/
│   └── login/page.tsx         # LoginMockCard (Suspense) → POST /api/auth/login
└── (dashboard)/
    ├── layout.tsx             # requireSession() → DashboardShell(user, wallet)
    ├── overview/page.tsx      # requireSession()
    ├── ad-accounts/page.tsx   # requirePermission + searchParams (?q, ?status)
    ├── payments/page.tsx      # requirePermission + searchParams (?tab, ?q, ?status, ?gateway)
    ├── affiliates/page.tsx    # requirePermission + searchParams (?tab)
    └── creative-analyzer/page.tsx  # requirePermission("creativeAnalyzer:read")
```

### Rutas públicas vs privadas

| Tipo | Rutas |
|---|---|
| Pública | `/`, `/login` |
| Privada (sesión) | `/overview`, `/ad-accounts`, `/payments`, `/affiliates`, `/creative-analyzer` |
| Dinámicas (searchParams) | `/ad-accounts`, `/payments`, `/affiliates` |
| API auth | `/api/auth/login`, `/api/auth/logout`, `/api/auth/session` |

---

## 6. Seguridad y autenticación (modo mock)

### Flujo de login mock

```
1. Usuario en /login pulsa "Continuar con Google"
2. LoginMockCard → POST /api/auth/login (credentials: include)
3. API valida `SESSION_SECRET` en producción (503 JSON si falta) y crea `SessionPayload`
4. API firma token HMAC-SHA256 y setea cookie dm_session (HttpOnly, SameSite=Lax)
5. Cliente redirige a /overview (o ?next= si venía de middleware)
6. middleware.ts valida cookie en cada request al dashboard
```

### Cookie de sesión

| Atributo | Valor |
|---|---|
| Nombre | `dm_session` |
| `HttpOnly` | Sí |
| `Secure` | Sí en producción (`NODE_ENV=production`) |
| `SameSite` | `Lax` |
| Duración | 7 días |
| Contenido | Payload JSON firmado (no JWT estándar; HMAC custom Edge-safe) |

### Guards (`lib/auth/guards.server.ts`)

```ts
requireSession()                        // → SessionUser | redirect /login
requireRole("admin" | ["admin","support"])
requirePermission("wallet:deposit")
requireCompanyAccess(companyId)
```

### Roles y permisos (`types/auth.ts`, `lib/auth/permissions.ts`)

**Roles:** `user` | `advertiser` | `admin` | `support`

**Permisos:**

| Permiso | Vista / acción |
|---|---|
| `wallet:read` | Ver cartera |
| `wallet:deposit` | Agregar saldo |
| `payments:read` | Pagos e historial |
| `adAccounts:read` | Listar cuentas |
| `adAccounts:create` | Crear cuenta |
| `affiliates:read` | Programa de afiliados |
| `creativeAnalyzer:read` | Analizador creativo |

**Rol mock actual:** `advertiser` — incluye todos los permisos del panel.

### Headers de seguridad (`next.config.ts`)

- `Content-Security-Policy` (incluye `https://cdn.simpleicons.org` en `img-src`)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, microphone, geolocation deshabilitados)
- `Strict-Transport-Security` (solo producción HTTPS)

### Módulos de auth

| Archivo | Función |
|---|---|
| `lib/auth/session-token.ts` | Firmar / verificar token (Web Crypto, Edge-compatible) |
| `lib/auth/session.server.ts` | `getSession`, `createMockSession`, lectura de cookies |
| `lib/auth/mock-session.ts` | Payload mock desde `userMock` |
| `lib/auth/guards.server.ts` | Guards server-side para páginas y API |
| `lib/auth/permissions.ts` | Mapa rol → permisos |
| `lib/env/env.server.ts` | Variables privadas + `assertProductionSecrets()` (helper; login valida explícitamente) |
| `lib/env/env.client.ts` | Variables públicas (`NEXT_PUBLIC_*`) |
| `lib/api/api-client.client.ts` | Fetch a `/api` con `credentials: include` |
| `lib/api/api-client.server.ts` | Stub HTTP al backend privado (futuro) |
| `middleware.ts` | Protección de rutas en el edge |

### Acciones sensibles — confirmación UX

| Acción | Componente | Comportamiento |
|---|---|---|
| Crear cuenta publicitaria | `CreateAdAccountModal` | Formulario → paso de confirmación |
| Agregar saldo | `AddBalanceModal` | Validación de monto → confirmación |

---

## 7. Layout del dashboard

### `(dashboard)/layout.tsx` (Server)

- Llama `requireSession()` antes de renderizar.
- Pasa `user` (desde sesión) y `wallet` (desde `walletMock` por ahora) a `DashboardShell`.
- **No importa mocks de usuario en componentes client.**

### `DashboardShell.client.tsx`

- Recibe `user` y `wallet` como props.
- Sidebar fijo desktop (`w-64`), drawer móvil (`w-[min(280px,85vw)]`, `pointer-events-none` cuando cerrado).
- Topbar con título dinámico, usuario de sesión y avatar.
- `FloatingSupportStack` cargado con `dynamic(..., { ssr: false })` — no bloquea el bundle inicial.
- Fondo app: `#f5f7fb`.
- Contenedor principal: `max-w-[1600px]`, `overflow-x-hidden`.
- Padding inferior extra en móvil (`pb-28`) para no tapar widgets flotantes.

### `DashboardSidebar.client.tsx`

- Recibe `wallet` como prop (no importa `walletMock` directamente).
- **Ancho controlado por el padre** — no usar `w-full` en clases base (conflicto con `w-64` en desktop).
- Logo **DM** + "Default Media".
- Card compacta de **Cartera Default** con saldo y CTA "Agregar saldo".
- Navegación con indicador lateral activo (`#4056ff`).

### `DashboardTopbar.tsx`

- Recibe `user` como prop (desde sesión).
- Título de vista desde `mainNavigation`.
- Subtítulo: "Bienvenido de nuevo, {user.name}".
- Botón **Salir** → `POST /api/auth/logout`.
- Iconos mock de notificación y ayuda.
- Email y avatar del usuario de sesión.

---

## 8. Sistema de diseño

### Paleta

| Token | Valor | Uso |
|---|---|---|
| Fondo app | `#f5f7fb` | Layout general |
| Superficies | `#ffffff` | Cards |
| Border | `#e5e7eb` / `#dbe1ea` | Bordes suaves |
| Texto principal | `#0f172a` | Títulos |
| Texto secundario | `#64748b` | Subtítulos, hints |
| Azul principal | `#4056ff` | CTAs, activos |
| Violeta | `#7c3aed` | Gradientes, acentos |
| Cyan | `#06b6d4` | Hero tech, analizador |
| Verde éxito | `#16a34a` | Estados positivos |
| Dark hero | `#070b1f` | Hero analizador creativo |

### Patrones visuales

- Cards: `rounded-2xl`, `border`, `shadow-sm`, hover `-translate-y-0.5` + `shadow-md`.
- Gradientes azul/violeta en heroes y banners.
- Glassmorphism moderado en heroes (`bg-white/10`, `backdrop-blur`).
- Badges informativos: "Modo mock", "Sin transacciones", etc.
- Sin imágenes externas obligatorias — SVG inline y CSS shapes.
- Logos de pasarelas: CDN `cdn.simpleicons.org` con fallback textual local.

### Utilidades (`lib/`)

- `cn()` — concatenación de clases.
- `formatMoney()` — `Intl.NumberFormat` USD.
- `formatNumber()` — números con separadores.

---

## 9. Componentes UI globales

| Componente | Ubicación | Notas |
|---|---|---|
| `Button` | `components/ui/Button.tsx` | variantes: primary, secondary, outline, ghost |
| `Card` | `components/ui/Card.tsx` | padding: none, sm, md, lg |
| `Input` | `components/ui/Input.tsx` | |
| `Badge` | `components/ui/Badge.tsx` | default, success, warning, info |
| `Tabs` | `components/ui/Tabs.tsx` | **Client** — tabs genéricas |
| `Table` | `components/ui/Table.tsx` | Table, TableHeader, TableBody, TableRow, TableHead, TableCell |
| `EmptyState` | `components/feedback/EmptyState.tsx` | soporta `action` opcional |
| `InfoAlert` | `components/feedback/InfoAlert.tsx` | alerta informativa |

---

## 10. Widgets flotantes (`components/floating/`)

Integrados una sola vez en `DashboardShell` (lazy). Visibles en todas las vistas del dashboard.

| Componente | Tipo | Función |
|---|---|---|
| `FloatingSupportStack.client.tsx` | Client | Orquesta el stack inferior derecho |
| `WhatsAppFloatingButton.client.tsx` | Client | Botón verde → `https://wa.me/000000000` (`rel="noopener noreferrer"`) |
| `SupportChatWidget.client.tsx` | Client | Chat mock con estados: home, conversation, faqCategories, faqCategoryDetail, faqArticleDetail |
| `OnboardingProgressWidget.client.tsx` | Client | Guía 0/3 — collapsed / expanded / closed |

### Datos de soporte

- `features/support/mocks/support.mock.ts`
- `features/support/types/support.types.ts`
- Vistas: `features/support/components/Chat*.tsx`

### Datos de onboarding flotante

- `features/onboarding/mocks/onboarding.mock.ts` — 3 pasos mock
- Toggle local de pasos completados (solo visual)

---

## 11. Módulos por vista

### `/login` — Auth mock con sesión

| Archivo | Tipo |
|---|---|
| `features/auth/components/LoginMockCard.client.tsx` | Client |

- Botón "Continuar con Google" → `POST /api/auth/login` → cookie de sesión → redirect.
- Soporta `?next=/ruta` para volver tras login forzado por middleware.
- Estados: loading, error.
- OAuth real se integrará cambiando `AUTH_MODE=oauth` y el handler de login.

---

### `/overview` — Descripción general

**Guard:** `requireSession()`  
**Service:** `getDashboardOverview()` → `mocks/dashboard.mock.ts`

| Componente | Tipo | Descripción |
|---|---|---|
| `OverviewHero` | Server | Hero gradiente + mini métricas decorativas |
| `OnboardingStepsCard` | Server | Pasos 0/3, barra progreso, timeline |
| `WalletOverviewCard` | Server | Card financiera de cartera |
| `MetricsGrid` | Server | 3 KPIs: gasto, referidos, cuentas |
| `AdAccountsOverviewTable` | Server | Tabla vacía con headers extendidos |

---

### `/ad-accounts` — Cuentas publicitarias

**Guard:** `requirePermission("adAccounts:read")`  
**Service:** `getAdAccountsOverview()` → `mocks/ad-accounts.mock.ts`  
**URL:** `?q=` (búsqueda), `?status=` (filtro estado)

**Composición en `page.tsx` (server):** filtra con `lib/filter/ad-accounts.ts` → renderiza tabla server.

| Componente | Tipo |
|---|---|
| `AdAccountsPageHeader` | Server |
| `AdAccountsInfoAlert` | Server |
| `AdAccountsSummaryCards` | Server — 4 KPIs |
| `AdAccountsToolbar.client` | Client — búsqueda/filtro (URL), modal lazy |
| `AdAccountsTable` | Server |
| `AdAccountsEmptyState` | Server — usa `AdAccountsOpenCreateModalButton.client` |
| `AdAccountsOpenCreateModalButton.client` | Client — dispara evento `ad-accounts:open-create-modal` |
| `CreateAdAccountModal.client` | Client — `dynamic()`, formulario + confirmación |

**Tipos:** `types/ad-account.ts` — `AdAccountStatus`: active | pending | disabled | review

**Fila mock opcional:** descomentar `sampleAdAccount` en `mocks/ad-accounts.mock.ts`

---

### `/payments` — Pagos y cartera

**Guard:** `requirePermission("payments:read")`  
**Service:** `getPaymentOverview()` → `mocks/payments.mock.ts`  
**URL:** `?tab=` (assignment \| account-tx \| wallet-tx \| refunds), `?q=`, `?status=`, `?gateway=`

**Composición en `page.tsx` (server):** stats, filtrado y tab content en servidor; controles interactivos en client mínimos.

| Componente | Tipo |
|---|---|
| `PaymentsPageHeader` | Server |
| `WalletSummaryPremium.client` | Client — CTA agregar saldo vía evento |
| `PaymentOverviewStats` | Server |
| `PaymentsGatewaySection.client` | Client — selector pasarela (URL `?gateway=`) |
| `PaymentGatewaySelector.client` | Client |
| `GatewayLogo` | Client — logos CDN Simple Icons + fallback |
| `PaymentsTabNav.client` | Client — tabs (URL `?tab=`) |
| `PaymentsTabContent` | Server — orquesta contenido por tab |
| `PaymentToolbar.client` | Client — búsqueda/filtro (URL) |
| `PaymentsTable` | Server |
| `PaymentsEmptyState` | Server — usa `PaymentsOpenAddBalanceButton.client` |
| `PaymentsHistoryEmpty` | Server — empty state tabs de historial |
| `PaymentsOpenAddBalanceButton.client` | Client — evento `payments:open-add-balance-modal` |
| `PaymentsAddBalanceModalHost.client` | Client — `dynamic(AddBalanceModal)`, escucha evento |
| `AddBalanceModal.client` | Client — validación monto + confirmación |

**Pasarelas mock:** Stripe, PayPal, Payoneer, USDT, Airwallex

**Logos CDN:** `cdn.simpleicons.org` (Stripe, PayPal, Payoneer, Tether). Airwallex usa fallback textual.

**Tabs:** Asignación de saldo | Historial cuenta | Historial cartera | Reembolsos

---

### `/affiliates` — Programa de afiliados

**Guard:** `requirePermission("affiliates:read")`  
**Service:** `getAffiliateProgram()` → `mocks/affiliates.mock.ts`  
**URL:** `?tab=` (earn \| payments)

**Composición en `page.tsx` (server):** contenido de tab en `AffiliateTabContent` (server).

| Componente | Tipo |
|---|---|
| `AffiliatesPageHeader` | Server |
| `AffiliateHero` | Client — hero + copiar enlace |
| `AffiliateOverviewStats` | Server — 4 KPIs |
| `AffiliateTabNav.client` | Client — tabs (URL) |
| `AffiliateTabContent` | Server — earn: workflow, link, banners, milestones, notes |
| `ReferralWorkflow` | Server |
| `ReferralLinkCard.client` | Client — copiar + métricas |
| `AffiliateBannerStudio.client` | Client |
| `BannerSizeSelector.client` | Client |
| `BannerPreviewPanel` | Client |
| `AffiliateMilestones` | Server — cards de hitos |
| `AffiliateNotes` | Server |

**Datos clave mock:**
- Código: `sandro-wong-mera`
- URL: `https://defaultmedia.mock/ref/sandro-wong-mera`
- Hitos: básico 5% | estándar 8% | profesional 12%

---

### `/creative-analyzer` — Analizador creativo

**Guard:** `requirePermission("creativeAnalyzer:read")`  
**Service:** `getCreativeAnalyzerOverview()` → `mocks/creative-analyzer.mock.ts`

| Componente | Tipo |
|---|---|
| `CreativeAnalyzerPageHeader` | Server |
| `CreativeAnalyzerHero` | Server — hero dark + dashboard mock |
| `CreativeAnalyzerStats` | Server — 4 KPIs |
| `CreativeAnalysisWorkflow` | Server — 4 pasos |
| `CreativeBenchmarkPanel` | Server — score 87, barras de señales |
| `CreativeValueGrid` | Server — 6 valores fundamentales |
| `CreativeAnalyzerCTA` | Server |

**Métricas mock:** 170 usuarios | 295 creativos | 156 ganadores | 34/128 políticas

**Señales:** Hook strength 92 | Retention 81 | CTA clarity 76 | Policy safety 96

---

## 12. Servicios mock (`services/`)

| Servicio | Retorna |
|---|---|
| `dashboard.mock.service.ts` | `getDashboardOverview()` |
| `ad-accounts.mock.service.ts` | `getAdAccountsOverview()`, `getAdAccounts()` (deprecated) |
| `payments.mock.service.ts` | `getPaymentOverview()` |
| `affiliates.mock.service.ts` | `getAffiliateProgram()` |
| `creative-analyzer.mock.service.ts` | `getCreativeAnalyzerOverview()` |

Patrón estándar:

```ts
export async function getDashboardOverview() {
  return dashboardMock;
}
```

**Política futura:** los servicios de negocio migrarán a `*.server.ts` y llamarán `api-client.server.ts` hacia el backend privado. Los mocks quedan solo para desarrollo/test.

---

## 13. Tipos principales (`types/`)

| Archivo | Interfaces clave |
|---|---|
| `user.ts` | `User` |
| `auth.ts` | `UserRole`, `Permission`, `SessionPayload`, `SessionUser` |
| `wallet.ts` | `Wallet` |
| `ad-account.ts` | `AdAccount`, `AdAccountsSummary`, `AdAccountsOverview` |
| `payment.ts` | `PaymentGateway`, `WalletOverview`, `PaymentOverview`, `PaymentTabKey` |
| `affiliate.ts` | `AffiliateProgramOverview`, `ReferralStep`, `BannerSize`, `AffiliateMilestone` |
| `creative-analyzer.ts` | `CreativeAnalyzerOverview`, `CreativeSignal`, `CreativeWorkflowStep` |
| `navigation.ts` | `NavItem` |

---

## 14. Criterio Server vs Client

### Patrón de composición (performance)

Evitar importar Server Components dentro de Client Components “orquestadores”. Patrón actual:

```
page.tsx (server)
├── lee searchParams, filtra datos
├── renderiza tablas/stats/content (server)
├── Suspense + toolbar/nav client (solo interacción)
└── modal host client con dynamic()
```

**Eventos de modal** (`lib/events/modal-events.ts`):

| Evento | Uso |
|---|---|
| `ad-accounts:open-create-modal` | Empty state / toolbar → `CreateAdAccountModal` |
| `payments:open-add-balance-modal` | Wallet / empty state → `AddBalanceModal` |

### Server Components (por defecto)

- Todas las `page.tsx` y `(dashboard)/layout.tsx`
- Cards estáticas, tablas sin interacción, heroes, métricas, milestones, notes
- Carga de datos vía services en el servidor
- Validación de sesión y permisos vía guards

### Client Components (`"use client"`)

| Área | Componentes |
|---|---|
| Auth | `LoginMockCard` |
| Layout | `DashboardShell`, `DashboardSidebar`, `DashboardTopbar` |
| Floating | `FloatingSupportStack` (lazy), `WhatsAppFloatingButton`, `SupportChatWidget`, `OnboardingProgressWidget` |
| UI interactiva | `Tabs` (genérico) |
| Ad accounts | `AdAccountsToolbar`, `AdAccountsOpenCreateModalButton`, `CreateAdAccountModal` (lazy) |
| Payments | `WalletSummaryPremium`, `PaymentsGatewaySection`, `PaymentsTabNav`, `PaymentToolbar`, `PaymentsOpenAddBalanceButton`, `PaymentsAddBalanceModalHost`, `AddBalanceModal` (lazy), `GatewayLogo` |
| Affiliates | `AffiliateHero`, `AffiliateTabNav`, `ReferralLinkCard`, `AffiliateBannerStudio`, `BannerSizeSelector`, `BannerPreviewPanel` |
| Support chat | Componentes importados por `SupportChatWidget` |

### Reglas de datos sensibles

- **Nunca** importar `mocks/` en Client Components de producción (excepto datos estáticos de soporte/onboarding).
- `user` y `wallet` del shell se pasan como props desde el layout server.
- Secretos solo en `lib/env/env.server.ts` — nunca en `NEXT_PUBLIC_*`.
- Client Components llaman mutaciones vía `api-client.client.ts` → `/api/*`.

---

## 15. Puntos de integración futura

| Feature | Estado | Dónde conectar |
|---|---|---|
| Google OAuth | Mock con sesión real | `AUTH_MODE=oauth`, `app/api/auth/login`, callback Google |
| API REST de negocio | No existe | `lib/api/api-client.server.ts` + `app/api/*` BFF |
| CSRF en mutaciones | Pendiente | Tokens en POST críticos (pagos, cuentas) |
| Validación Zod | Pendiente | `lib/validation/*` en API y formularios |
| Persistencia cuentas | Mock local | `CreateAdAccountModal` → `POST /api/ad-accounts` |
| Pagos reales | Mock | `AddBalanceModal` → pasarela vía BFF |
| Clipboard / chat soporte | Mock funcional | `SupportChatWidget`, `ReferralLinkCard` |
| Onboarding progreso real | Mock toggle | `OnboardingProgressWidget` + API usuario |
| RBAC multi-tenant | Parcial (guards listos) | `requireCompanyAccess()` + backend |

---

## 16. Restricciones y convenciones del proyecto

- Trabajar sobre **main** (sin ramas obligatorias para features mock).
- Copiar `.env.example` → `.env.local` para desarrollo; **no commitear `.env*`**.
- `SESSION_SECRET` obligatorio en producción (`openssl rand -base64 32` o `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
- En **Vercel**: configurar `SESSION_SECRET`, `AUTH_MODE=mock`, `NEXT_PUBLIC_AUTH_MODE=mock`, `NEXT_PUBLIC_APP_URL` y **redesplegar** tras añadir variables.
- **No instalar dependencias** sin aprobación — usar SVG inline.
- Mantener **`npm run build`** compilable tras cada cambio.
- Commits solo cuando el usuario lo solicite.
- Marca siempre ficticia: **Default Media** (no copiar marcas reales).
- Mocks: solo datos ficticios (`*.mock`, sin correos/tokens/keys reales).

---

## 17. Árbol de archivos (resumen)

```
web-base/
├── app/
│   ├── api/auth/{login,logout,session}/
│   ├── (auth)/login/
│   ├── (dashboard)/{overview,ad-accounts,payments,affiliates,creative-analyzer}/
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   ├── layout/
│   ├── feedback/
│   └── floating/
├── config/
│   ├── site.ts
│   ├── routes.ts
│   ├── navigation.ts
│   └── auth.ts
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── ad-accounts/
│   ├── payments/
│   ├── affiliates/
│   ├── creative-analyzer/
│   ├── support/
│   └── onboarding/
├── lib/
│   ├── auth/
│   ├── env/
│   ├── api/
│   ├── filter/              # ad-accounts.ts, payment-accounts.ts
│   ├── events/              # modal-events.ts
│   ├── search-params.ts
│   ├── cn.ts
│   ├── format-money.ts
│   └── format-number.ts
├── mocks/
├── services/
├── types/
├── middleware.ts
├── .env.example
├── next.config.ts          # Security headers + CSP
├── AGENTS.md
├── CLAUDE.md
└── PROJECT_CONTEXT.md      ← este archivo
```

---

## 18. Rutas para probar

| Ruta / acción | Qué validar |
|---|---|
| `/` | Redirect a `/login` |
| `/overview` sin sesión | Redirect a `/login?next=/overview` |
| `/login` | Mock Google → POST API → cookie → `/overview` |
| `/login` con sesión activa | Redirect automático a `/overview` |
| `/overview` | Hero, onboarding, cartera, KPIs, tabla vacía |
| `/ad-accounts` | Summary cards, toolbar (URL filters), modal crear lazy, empty state con evento |
| `/payments` | Wallet, pasarelas (`?gateway=`), tabs (`?tab=`), filtros (`?q`, `?status`), modal lazy |
| `/affiliates` | Hero, copiar enlace, banners, hitos, tabs (`?tab=earn\|payments`) |
| `/creative-analyzer` | Hero dark, benchmark, workflow, CTA |
| **Salir** (topbar) | `POST /api/auth/logout` → `/login` |
| `GET /api/auth/session` | 401 sin cookie; 200 con datos de usuario si hay sesión |
| `/login` sin `SESSION_SECRET` (prod) | Mensaje 503 claro en UI (configurar Vercel env) |
| Responsive | Sidebar `w-64` desktop; drawer móvil; tablas con scroll horizontal |
| Todas (dashboard) | Widgets flotantes: WhatsApp, chat, onboarding 0/3 |

---

## 19. Checklist de seguridad por fase

### Antes de OAuth real
- [x] Middleware protegiendo dashboard
- [x] Sesión mock con cookie HttpOnly firmada
- [x] Guards server-side (`requireSession`, `requirePermission`)
- [x] BFF auth en `app/api/auth/*`
- [x] `.env.example` documentado
- [ ] `AUTH_MODE=oauth` + Google OAuth callback
- [ ] `GOOGLE_CLIENT_SECRET` solo en servidor

### Antes de APIs de negocio reales
- [ ] `app/api/*` para wallet, cuentas, pagos
- [ ] `api-client.server.ts` conectado a `API_BASE_URL`
- [ ] Validación de payload (Zod)
- [ ] DTOs mínimos al cliente

### Antes de pagos reales
- [x] Confirmación UX en depósitos (mock)
- [ ] CSRF en mutaciones POST
- [ ] Idempotency keys
- [ ] Permiso `wallet:deposit` validado en backend

### Producción
- [x] Security headers + CSP
- [x] `error.tsx` / `not-found.tsx`
- [x] Login devuelve error JSON si falta `SESSION_SECRET` (503)
- [ ] `SESSION_SECRET` configurado en Vercel/producción + redeploy
- [ ] Branch protection + Dependabot + CodeQL

---

## 20. Referencias internas

- `AGENTS.md` / `CLAUDE.md` — reglas Next.js 16 (APIs pueden diferir de versiones anteriores).
- Consultar `node_modules/next/dist/docs/` antes de cambios que usen APIs de Next.js.
- `.env.example` — variables de entorno requeridas.

---

*Última actualización: julio 2026 — panel mock Default Media con seguridad (sesión, middleware, guards, BFF auth), composición server/client (URL filters/tabs, lazy modales/widgets), responsive y deploy Vercel.*
