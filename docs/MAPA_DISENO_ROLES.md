# Mapa de diseño del sistema Holistic

> Documento de referencia para rediseñar el interior del producto.
> Personas operativas a diseñar: **Cliente**, **Gerente** y **Super Admin**.
>
> Actualizado: 2026-08-07  
> Código revisado en: roles de pagos, Hecom OTP, panel admin, navegación dashboard.

---

## 1. Cómo pensar los 3 registros (importante)

En la UI hablamos de **3 perfiles de operación**. En el código **no hay un enum único** `cliente | gerente | super_admin`. Son capas independientes:

| Capa | Qué decide | Dónde vive |
|------|------------|------------|
| **Persona de negocio** (lo que diseñamos) | Qué ve / qué puede fondear | Emails staff, super admin, links Hecom |
| **Org membership (`app_role`)** | Permisos de API/páginas | `organization_memberships.role` en DB |
| **Allowlist admin panel** | Entra a `/admin/*` | `ADMIN_ALLOWED_EMAILS` |

```
Usuario Supabase Auth
   │
   ├─► ¿Email en lista staff o owner/admin org?  →  GERENTE (ops Holistic)
   ├─► ¿Email ligado a cliente(s) Hecom?         →  CLIENTE
   ├─► ¿Email en PAYMENTS_SUPER_ADMIN_EMAILS?    →  SUPER ADMIN (pagos dual)
   └─► ¿Email en ADMIN_ALLOWED_*?                →  Panel /admin (backoffice)
```

**Una persona real (ej. Atter) puede ser las tres a la vez** si está en staff + super admin pagos + admin allowlist.

---

## 2. Las 3 personas a diseñar

### 2.1 Cliente

| | |
|--|--|
| **Quién es** | Anunciante / agencia que opera **solo sus** clientes Hecom |
| **Cómo entra** | `/login` → OTP por email (cuando `AUTH_HECOM_OTP_LOGIN=true`) |
| **Cómo se identifica** | Email en Hecom CRM `clientes.emails[]` o lista de prueba |
| **Ámbito de datos** | Solo clientes linkeados (`hecom_cliente_user_links` + cookie seleccionada) |
| **Fondeo** | Solo modo **cliente**: Stripe / cartera / voucher → asignar a ads |
| **No puede** | Ver todos los clientes, fondear desde cash del Business Center TikTok, entrar a `/admin` (salvo allowlist aparte) |

**Pantallas del dashboard que usa:**

| Ruta | Módulo | Notas de diseño |
|------|--------|-----------------|
| `/overview` | Resumen | Stats del cliente seleccionado |
| `/clientes` | Selector | Solo 1 o pocos; si 1, a veces salta directo a overview |
| `/ad-accounts` | Cuentas ads | TikTok del cliente activo |
| `/payments` | Pago | Recarga + asignación; **sin** switch BM |
| `/affiliates` | Afiliados | Limitado / nota org |
| `/creative-analyzer` | Creativos | Upload y jobs del scope |

**Shell actual:** misma sidebar que el gerente (`mainNavigation` en `config/navigation.ts`).  
**Oportunidad de diseño:** ocultar o relabelar “Clientes” si solo tiene uno; enfatizar cartera y ads.

**Auth flow:**

```
/login (solo email)
  → POST /api/auth/otp/request
  → /verify-otp  o  magic link
  → provision Hecom
  → 1 cliente → /overview
  → N clientes → /clientes (picker)
```

**Archivos clave:**

- `lib/auth/hecom-otp.server.ts`
- `lib/hecom/selected-cliente.server.ts`
- `features/auth/*`, `features/clientes/*`, `features/payments/*`

---

### 2.2 Gerente (staff Holistic)

| | |
|--|--|
| **Quién es** | Operación interna Holistic: elige cualquier cliente y opera por él |
| **Cómo entra** | Mismo `/login` OTP que el cliente |
| **Cómo se identifica** | Email en `AUTH_HECOM_OTP_STAFF_EMAILS` (o defaults hardcode) **o** en `ADMIN_ALLOWED_EMAILS` **o** org role `owner`/`admin` (para funding) |
| **Ámbito de datos** | **Todos** los clientes Hecom → picker siempre `/clientes` |
| **Fondeo** | Solo modo **gerente / agency_bm**: cash del Business Center → ads |
| **No puede** | Crear intents Stripe de recarga de cartera cliente (API lo rechaza) |

**Pantallas:** las mismas rutas del dashboard **+** comportamiento distinto:

| Ruta | Diferencia vs Cliente |
|------|------------------------|
| `/clientes` | Lista completa CRM Hecom |
| `/payments` | Copy “Modo gerente”, asignación desde BM, sin Stripe de cliente |
| `/overview`, `/ad-accounts`, etc. | Datos del **cliente seleccionado** (contexto de trabajo) |

**Shell actual:** misma `mainNavigation`.  
**Oportunidad de diseño:** badge “Modo gerente”, selector de cliente más pro, color/tono distinto al del cliente final.

**Auth flow:**

```
/login OTP (staff permitido aunque no tenga clientes linkeados)
  → provision → needsPicker → /clientes (lista full)
  → elige cliente → cookie vv_hecom_cliente_id
  → opera el resto del panel “como ese cliente”
```

**Archivos clave:**

- `lib/auth/hecom-otp.server.ts` → `isHecomOtpStaffEmail`
- `lib/payments/funding-roles.server.ts` → `isStaff`, `canAgencyBmFund`
- `docs/TIKTOK_BC_FUNDING.md`

---

### 2.3 Super Admin

Hay **dos “super” en el sistema**. Para diseño de producto:

#### A) Super Admin de **Pagos** (persona dual)

| | |
|--|--|
| **Quién es** | Quien puede **cambiar de modo** Cliente ↔ Gerente en Pagos |
| **Cómo se identifica** | `PAYMENTS_SUPER_ADMIN_EMAILS` (default: Atter) |
| **Dónde se ve** | Principalmente `/payments` → switch de funding mode |
| **Capacidad** | Stripe/cartera **y** cash BM (`canSwitchFundingModes`) |

UI existente: `PaymentsFundingModeSwitch` + `PaymentsFundingModeContext`.

#### B) **Admin panel** (backoffice `/admin`)

| | |
|--|--|
| **Quién es** | Operaciones internas globales (finanzas, soporte, audit) |
| **Cómo entra** | `/admin/login` (password Supabase) + allowlist |
| **Cómo se identifica** | `ADMIN_ALLOWED_EMAILS` / `ADMIN_ALLOWED_USER_IDS` |
| **Shell** | Navegación propia (`adminNavigation`), **no** la del dashboard cliente |

**Mapa de pantallas admin (todas a rediseñar como un producto aparte):**

| Grupo | Rutas |
|-------|-------|
| Operación | `/admin/overview`, `/admin/clientes`, `/admin/clientes/[id]`, `/admin/organizations`, `/admin/organizations/[id]`, `/admin/users`, `/admin/ad-accounts`, `/admin/support` |
| Finanzas | `/admin/payments`, `/admin/payments/[id]`, `/admin/refunds`, `/admin/ledger`, `/admin/reconciliation` |
| Growth & Ads | `/admin/affiliates`, `/admin/creatives` |
| Sistema | `/admin/webhooks`, `/admin/audit`, `/admin/integrations`, `/admin/settings` |
| Auth admin | `/admin/login`, `/admin/unauthorized` |

**Archivos clave:**

- `lib/admin/allowlist.ts`, `lib/admin/auth.ts`
- `config/navigation.ts` → `adminNavigation`
- `components/admin/*`, `features/admin/*`
- Tokens: `components/admin/adminDesignSystem.ts`

---

## 3. Matriz rápida (diseño)

| Dimensión | Cliente | Gerente | Super Admin pagos | Admin panel |
|-----------|---------|---------|-------------------|-------------|
| Login | `/login` OTP | `/login` OTP | suele ser staff+super | `/admin/login` password |
| Shell UI | Dashboard | Dashboard | Dashboard (+ switch pagos) | Admin shell |
| Lista clientes | Solo suyos | Todos | Todos (si también staff) | CRM admin |
| Recarga Stripe | Sí | No | Sí (modo cliente) | Aprueba manual / no es “su” recarga |
| Fund BM | No | Sí | Sí (modo gerente) | Ops aparte |
| Switch modo pagos | No | No | **Sí** | N/A |
| Sidebar items | Overview, Clientes, Cuentas, Pago, Afiliados, Creativos | Igual | Igual | 16 módulos admin |

---

## 4. Navegación actual del dashboard (cliente + gerente)

Fuente: `config/navigation.ts` → `mainNavigation`

1. Descripción general → `/overview`  
2. Clientes → `/clientes`  
3. Mis cuentas publicitarias → `/ad-accounts`  
4. Pago → `/payments`  
5. Programa de afiliados → `/affiliates`  
6. Analizador creativo → `/creative-analyzer`  

**Hoy no se filtra por persona** (misma nav para todos).  
Al rediseñar: filas / labels / CTA primarios **según persona**.

---

## 5. Capas de permiso org (no confundir)

DB `app_role`: `owner | admin | advertiser | finance | viewer | support`  
Archivo: `types/auth.ts` + `lib/auth/permissions.ts`.

| Rol org | Idea |
|---------|------|
| owner / admin | Casi todo |
| advertiser | Ads + pagos R/W + creativos |
| finance | Cartera/pagos, sin crear ads |
| viewer | Solo lectura |
| support | Lectura + tickets |

Esto **no reemplaza** las 3 personas Hecom/pagos; es la matriz clásica de permisos de página.

---

## 6. Superficies de diseño prioritarias

Orden sugerido para el trabajo visual:

### A. Público (ya en progreso)

1. Landing `/`  
2. Login `/login`  
3. OTP `/verify-otp`  
4. Forgot password  

### B. Dashboard unificado (cliente + gerente)

1. Shell: sidebar, top bar, selector de cliente  
2. Overview  
3. Clientes (picker distinto por persona)  
4. Pagos (**crítico**: 3 modos visuales — cliente / gerente / dual)  
5. Cuentas ads  
6. Creativos  
7. Afiliados  

### C. Super Admin / Admin panel

1. Login admin  
2. Shell admin  
3. Overview KPIs  
4. Clientes + organizaciones + usuarios  
5. Pagos manuales + reembolsos  
6. Ledger + conciliación  
7. Resto (webhooks, audit, integraciones, settings)  

---

## 7. Env que definen a cada persona

| Variable | Persona |
|----------|---------|
| `AUTH_HECOM_OTP_LOGIN` | Activa login OTP clientes |
| `AUTH_HECOM_OTP_STAFF_EMAILS` | **Gerentes** |
| `AUTH_HECOM_OTP_TEST_EMAILS` | Clientes piloto |
| `PAYMENTS_SUPER_ADMIN_EMAILS` | **Super admin pagos** (switch BM/Stripe) |
| `ADMIN_ALLOWED_EMAILS` / `ADMIN_ALLOWED_USER_IDS` | **Admin panel** |
| `TIKTOK_BC_FUNDING_ENABLED` | Fund real BM (gerente) |

Definidas en `lib/env/env.server.ts`.

---

## 8. Archivos de código por persona (atajos)

| Tema | Path |
|------|------|
| Roles pagos cliente/gerente/super | `lib/payments/funding-roles.server.ts` |
| Staff Hecom OTP | `lib/auth/hecom-otp.server.ts` |
| Session + app_role | `lib/auth/session.server.ts` |
| Allowlist admin | `lib/admin/allowlist.ts` |
| Rutas | `config/routes.ts` |
| Nav dashboard / admin | `config/navigation.ts` |
| Auth path helpers | `config/auth.ts` |
| Proxy/middleware | `proxy.ts` |
| Plan OTP original | `docs/PLAN_AUTH_OTP_HECOM_CLIENTES.md` |
| BM funding | `docs/TIKTOK_BC_FUNDING.md` |

---

## 9. Checklist de diseño (por pantalla)

Para cada pantalla del interior, decidir:

- [ ] ¿Se ve **solo cliente**, **solo gerente**, **ambos** o **admin**?
- [ ] ¿Qué copy cambia? (ej. “Recargar cartera” vs “Asignar desde BM”)
- [ ] ¿Qué acciones se ocultan / deshabilitan?
- [ ] ¿Hace falta badge de contexto? (“Operando como: Nombre Cliente”)
- [ ] ¿Móvil: misma IA o compacta por persona?

---

## 10. Resumen en una frase

- **Cliente** → opera su inversión (Stripe + ads) en el dashboard.  
- **Gerente** → opera **por** cualquier cliente, fondea con cash BM.  
- **Super Admin** → en pagos puede **los dos caminos**; en `/admin` es el **backoffice** de la operación Holistic.

Usar este mapa al rediseñar shells, CTAs y flujos de Pagos para no mezclar pantallas ni permisos.

---

## 11. Avance de diseño (log)

| Fecha | Qué se hizo |
|-------|-------------|
| 2026-08-07 | **Shell dashboard v1**: tokens warm Holistic, sin DotGrid, badge persona (Cliente / Gerente / Super admin) en sidebar + topbar + menú usuario, labels nav cortos, contexto “Operando: cliente”, card de saldo más compacta. Archivos: `app/(dashboard)/layout.tsx`, `components/layout/*`, `types/dashboard-persona.ts`, `app/globals.css` (`.dashboard-*`). |
| 2026-08-07 | **Overview + Clientes**: Overview claro (sin franja negra, sin BlurText); KPIs en grid light; accesos rápidos; paneles TikTok/gastos. Clientes: picker limpio, search, contador, sin console.log, copy para scoped vs staff. |
| Next | Pagos (3 modos visuales cliente / gerente / dual) → Cuentas ads → Creativos → Admin panel. |
