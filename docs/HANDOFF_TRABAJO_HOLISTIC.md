# Handoff pro · Ads Holistic (Proyectovv)

> **Para qué es este doc:** que otro chat de Cursor (o dev) entienda **qué se hizo**, **por qué**, **dónde vive en código** y **qué no romper**.  
> **Product:** Holistic Marketing / Ads Holistic (`adsholistic.com`)  
> **Repo:** `Proyectovv`  
> **Actualizado:** 2026-08-08  
> **Stack:** Next.js App Router · Supabase · Hecom CRM · TikTok Business Center · Stripe

---

## 0. Prompt listo para otro Cursor

```
Leé y seguí el handoff en docs/HANDOFF_TRABAJO_HOLISTIC.md antes de tocar Pagos, roles, shell o sidebar.
No inventes dark-mode purple ni quites el path BM del gerente.
Diseño: docs/SISTEMA_DISENO_HOLISTIC.md
Roles UX: docs/MAPA_DISENO_ROLES.md
Prioridad actual: gerente debe poder Asignar/fondear igual que super admin (misma cliente) y ver saldo estimado Hecom (no "—").
```

---

## 1. Resumen ejecutivo (qué se hizo en esta línea de trabajo)

Se rediseñó y estabilizó el producto **light corporativo Holistic** (naranja `#ff781f`) y se corrigió un bug crítico: **el gerente no veía “Asignar” / fondeo BM** aunque el **super admin sí** en el mismo cliente. Luego se pulió la UI de gerente para mostrar **saldo estimado y KPIs Hecom** (no solo cartera Holistic $0).

### Entregables principales

| Área | Estado | Notas |
|------|--------|--------|
| Design system documentado | ✅ | `docs/SISTEMA_DISENO_HOLISTIC.md` |
| Mapa de roles Cliente / Gerente / Super admin | ✅ | `docs/MAPA_DISENO_ROLES.md` |
| Landing + auth light + shell dashboard | ✅ | tokens en `app/globals.css` + landing CSS |
| Pagos por persona (Stripe vs BM) | ✅ | `funding-roles.server.ts` |
| Bug gerente sin “Asignar” | ✅ fix en código | requiere **deploy** para validar en prod |
| Saldo estimado en shell + Pagos gerente | ✅ | `includeSaldo: true` + KPIs Hecom en UI |
| Creativos / Afiliados | ⚠️ existen + look light | no son el core del pitch (satélites) |

---

## 2. Personas de demo (emails)

Resueltas por email, no solo por `organization_memberships.role`:

| Email | Persona | Fondeo |
|-------|---------|--------|
| `ferbasiliorengifo@gmail.com` | **Cliente** | Solo Stripe / cartera |
| `atlvbasiliorengifo@gmail.com` | **Gerente** | Solo cash BM (sin Stripe) |
| `attermayerbasiliorengifo@gmail.com` | **Super admin** (default) | Dual: Cliente (Stripe) **o** Gerente (BM) |

**Código:**

- `lib/auth/demo-personas.server.ts` — demo cliente/gerente
- `lib/auth/hecom-otp.server.ts` — staff OTP (`isHecomOtpStaffEmail`, lista `DEFAULT_STAFF_EMAILS` incluye atlv + attermayer + gerentes reales)
- `lib/payments/funding-roles.server.ts` — capabilities de Pagos

**Importante:** `atlv…` **sí es gerente oficial en app** (demo + staff). Si no ve Asignar, **no** es “porque no es gerente de verdad”.

---

## 3. Reglas de fondeo (producto)

| Persona | Camino de dinero | Cartera Holistic | Deuda neta Hecom |
|---------|------------------|------------------|------------------|
| **Cliente** | Stripe → wallet → asignar a ads | Sí se usa | Baja con cobro, no con fondeo BM |
| **Gerente** | Cash del Business Center TikTok → cuenta ads | **No** se usa para fondear | **No baja** con fondeo BM (solo con cobro cliente) |
| **Super admin** | Switch UI: Cliente **o** Gerente | Según modo | Mismo modelo |

Copy obligatorio en BM: *el fondeo BM no baja la deuda neta Hecom*.

---

## 4. Bug crítico resuelto: Gerente sin “Asignar”

### Síntoma (reportado + screenshots)

- Login **gerente** (`atlv…`) · cliente Branlyn / Adriana · Pagos: **Cuentas listas = 0**, empty *“Sin cuentas Aprobadas para asignar”*.
- Login **super admin** · mismo cliente · **Asignar** visible en 3 cuentas.

### Causas reales (no el rol)

1. **Orgs distintas:** `ad_accounts` se guardan por `organization_id`. Super admin ya tenía filas en *su* org; el gerente entraba a *otra* org vacía.
2. Sync BM a veces **vacío** + **cache 5 min de lista TikTok vacía** → gerente se congelaba en 0.
3. Listado a veces dependía de **RLS / client supabase** con rol `viewer` en org membership → pool vacío.
4. Scope solo con IDs Hecom mapeados; muchos clientes solo aparecen por **match de nombre en BM**.
5. Sidebar con `includeSaldo: false` → **“—”** de saldo (look roto, aparte del bug de Asignar).

### Fixes aplicados

| Fix | Dónde |
|-----|--------|
| Sync approved + upsert en **org del usuario** | `lib/hecom/sync-approved-ad-accounts.server.ts` |
| BM **live** en path fondeo (no cold `[]`) | mismo + `bc-advertisers.server.ts` |
| **No cachear** listas TikTok vacías | `listHolisticBcAdvertisers` |
| IDs de Pagos = overview Hecom **+** BM nombre | `app/(dashboard)/payments/page.tsx` + `ad-accounts.server.ts` |
| Listar `ad_accounts` con **service role** | `listOrganizationAdAccountsForAllocation` |
| **Mirror/ensure** advertisers en la org del gerente (copia de otras orgs) | `ensureAdvertisersInOrganizationForAllocation` |
| Fallback por `metadata.hecom_cliente_id` | `PaymentsGatewayPanel.tsx` |
| Staff OTP → `payments:create` aunque org role sea `viewer` | `session.server.ts` + `permissions.ts` |
| Cache sync vacío corta TTL | `SYNC_EMPTY_TTL_MS` etc. |

### Logs útiles en prod

```
[payments] allocate_scope
[payments] ensure_advertisers_in_org
[payments] allocate_from_meta_mirror
[hecom-sync] approved_sync
[ad-accounts] overview
[tiktok-bc] list_advertisers_ok
```

**Esperado post-deploy gerente:** `approvedIds > 0`, `ensured` o `upserted > 0`, UI con filas + link **Asignar**.

---

## 5. UI gerente: saldo estimado y pulso Hecom

### Problema

Gerente veía:

- Sidebar: **Saldo estimado —**
- Pagos: “Cartera Holistic **$0** · No se usa en modo BM”
- Super admin / historial: números reales ($ cobros, gastos, deuda)

### Solución

| Pieza | Cambio |
|-------|--------|
| Shell layout | `getHecomClienteShell(..., { includeSaldo: true })` |
| Hero Pagos | card **Saldo estimado Hecom** + cobros/gastos/fees |
| Bloque superior | modo gerente-only-BM → **“Operación Hecom”** (no wallet $0) |
| Resumen mid | KPIs Hecom: saldo, cobros, cuentas listas, gastos |
| Historial | copy staff: BM no baja deuda |
| Tipo shared | `features/payments/types/hecom-finance-snapshot.ts` |

**Archivos clave UI:**

- `app/(dashboard)/layout.tsx`
- `components/layout/SidebarWalletCard.client.tsx`
- `features/payments/components/PaymentsPageHero.tsx`
- `features/payments/components/WalletSummaryPremium.tsx`
- `features/payments/components/PaymentOverviewStats.tsx`
- `features/payments/components/PaymentsWalletSection.tsx`
- `features/payments/components/PaymentsGatewayPanel.tsx`
- `features/clientes/components/ClienteScopedPayments.tsx`
- `app/(dashboard)/payments/page.tsx`

---

## 6. Diseño visual (contrato)

Fuente de verdad de marca: **`docs/SISTEMA_DISENO_HOLISTIC.md`**.

Resumen de una línea:

> Light warm ops · Sora + Plus Jakarta · naranja `#ff781f` · soft `#fff1e8` · bordes `#ece7e0` · canvas `#faf8f5` · **zero purple AI / zero dark-first**.

Tokens runtime: `app/globals.css` (`.dashboard-canvas`, `.auth-canvas`, admin tokens).  
Landing: `features/landing/techlo-landing.css`.  
Fonts: `app/layout.tsx` (`--font-jakarta`, `--font-sora`).

---

## 7. Arquitectura de datos (mental model)

```
Usuario (email → persona)
   │
   ├─ Session + permissions (Supabase org role + staffPayments)
   │
   ├─ Cliente operativo (cookie vv_hecom_cliente_* + owner scope)
   │
   ├─ Hecom CRM (nombre, cobros, gastos, saldo estimado, mapeo tiktok)
   │
   ├─ TikTok BC (list advertisers, status Aprobado/Suspendido)
   │     match: Hecom advertiser_id  OR  nombre ≈ cliente
   │
   └─ Holistic DB ad_accounts (por organization_id)
         upsert al fondear / sync
         Asignar/fondear BM opera sobre filas de ESA org
```

**Implicación:** dos usuarios staff = **puede** haber dos orgs. El path gerente **debe** ensure/upsert en **su** org; no alcanza con que el super admin ya tenga filas.

Cookie de cliente: scoped por user (`vv_hecom_cliente_owner`) para no heredar “cliente del login anterior” al cambiar de cuenta.

---

## 8. Mapa de archivos por dominio

### Auth / roles

| Archivo | Rol |
|---------|-----|
| `lib/auth/demo-personas.server.ts` | Emails demo cliente/gerente |
| `lib/auth/hecom-otp.server.ts` | OTP staff, provision, picker |
| `lib/auth/session.server.ts` | Session + `staffPayments` |
| `lib/auth/permissions.ts` | `getPermissionsForRole(..., { staffPayments })` |
| `lib/payments/funding-roles.server.ts` | Capabilities Pagos |

### Hecom / ads / sync

| Archivo | Rol |
|---------|-----|
| `lib/hecom/cliente-dashboard.server.ts` | Dashboard + shell + `saldoEstimado` |
| `lib/hecom/ad-accounts.server.ts` | Overview cuentas (Hecom + BM nombre) |
| `lib/hecom/sync-approved-ad-accounts.server.ts` | Sync Aprobadas → upsert org |
| `lib/hecom/selected-cliente.server.ts` | Cookie cliente operativo |
| `lib/integrations/tiktok/bc-advertisers.server.ts` | Lista BC + cache (no vacíos) |

### Pagos

| Archivo | Rol |
|---------|-----|
| `app/(dashboard)/payments/page.tsx` | Página Pagos + `hecomFinance` |
| `features/payments/components/PaymentsGatewayPanel.tsx` | Core Asignar + ensure org |
| `services/payments.service.ts` | Core wallet + admin list + ensure advertisers |
| `lib/payments/scope-hecom-accounts.ts` | Filtra pool por advertiser IDs |

### Shell UX

| Archivo | Rol |
|---------|-----|
| `app/(dashboard)/layout.tsx` | Persona + shell con saldo |
| `components/layout/*` | Sidebar, topbar, nav |
| `features/clientes/*` | Overview, picker CRM, scoped sections |

### Docs relacionados

| Doc | Uso |
|-----|-----|
| `docs/SISTEMA_DISENO_HOLISTIC.md` | Design system para UI |
| `docs/MAPA_DISENO_ROLES.md` | Personas y pantallas |
| `docs/TIKTOK_BC_FUNDING.md` | Fondeo BM técnico |
| **este archivo** | Handoff de trabajo reciente |

---

## 9. Qué NO hacer (trampas)

1. **No** volver a `includeSaldo: false` en layout sin alternativa async → vuelve el “—” en sidebar.
2. **No** cachear listas TikTok **vacías** 5 min.
3. **No** filtrar `ad_accounts` solo por org del super admin y asumir que el gerente las ve.
4. **No** tratar a `atlv…` como “no staff” (rompe gerente demo).
5. **No** aplicar dark purple SaaS al dashboard; el producto es **light Holistic**.
6. **No** confundir **cartera Holistic $0** (normal en BM) con **sin datos**: hay que mostrar **Hecom**.
7. **No** inventar enum único de rol en DB; la persona es **email + capabilities + org role**.
8. **No** afirmar que el fondeo BM reduce deuda Hecom en copy/UI.

---

## 10. Checklist QA post-deploy

### Gerente (`atlvbasiliorengifo@gmail.com`)

- [ ] Badge **GERENTE**
- [ ] Sidebar: cliente operativo + **saldo estimado numérico** (no “—” eterno)
- [ ] Página Clientes: lista CRM + “Fondear este cliente”
- [ ] Pagos: bloque **Operación Hecom** con saldo/cobros/gastos
- [ ] Resumen: KPIs Hecom (no “Cartera no se usa en BM” como única métrica)
- [ ] Con cliente que super admin puede fondear: **Cuentas listas ≥ 1** + **Asignar**
- [ ] Historial Hecom visible (cobros/gastos) + copy BM

### Super admin (`attermayer…`)

- [ ] Switch Cliente | Gerente
- [ ] En modo BM: misma capacidad Asignar que antes
- [ ] En modo Cliente: Stripe / cartera

### Cliente (`ferbasilio…`)

- [ ] Sin picker global de CRM (scope propio)
- [ ] Pagos solo Stripe/cartera
- [ ] No camino BM

### Performance

- [ ] Layout puede ser un poco más lento por saldo Hecom (aceptable)
- [ ] Warm BC en background sigue en layout para staff

---

## 11. Historial de workstreams (esta conversación ampliada)

1. **Rediseño UI** landing / auth / shell / overview / clientes / pagos (light Holistic).  
2. **Personas demo** + UX cliente vs gerente (nav, picker, cookie owner).  
3. **Perf:** cache BC, shell lite (después se revirtió saldo vacío porque rompía UX).  
4. **Bug gerente Asignar** (org + sync + service role + ensure).  
5. **Doc design system** para reusar look en otros agentes.  
6. **Pulido KPIs Hecom** en gerente (sidebar + pagos + copy).  
7. **Este handoff** para continuidad entre chats.

---

## 12. Estado “pendiente de validación humana”

- Confirmar en **producción** (después de deploy del fix) que gerente ve Asignar en Adriana / Branlyn / cliente real con ads Aprobadas.
- Si sigue en 0: revisar env TikTok (`TIKTOK_ACCESS_TOKEN`, BC IDs), logs `allocate_scope` / `ensure_advertisers_in_org`.
- Creativos / Afiliados: ok para demo visual; no el núcleo del valor.

---

## 13. Una frase para el siguiente agente

> En Holistic el **gerente** fondea con **cash BM** en **su** `organization_id`, debe **ver y crear** las mismas cuentas Aprobadas que el super admin, y la UI de operaciones debe mostrar **saldo estimado Hecom** (no “—”, no solo “cartera $0 no se usa”). Diseño: light naranja documentado en `SISTEMA_DISENO_HOLISTIC.md`.

---

## 14. Cómo nombrar commits (si el usuario pide commit)

Ejemplos alineados al trabajo:

- `fix(payments): ensure BM assign accounts in gerente org`
- `fix(shell): show Hecom estimated balance for staff sidebar`
- `docs: add Holistic design system and work handoff`

*(No commitear ni pushear a menos que el usuario lo pida.)*
