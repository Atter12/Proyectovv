# Handoff — Continuidad Holistic / Proyectovv

> **Para:** retomar en otra PC / otro chat Cursor  
> **Actualizado:** 2026-08-20  
> **Repo:** `Atter12/Proyectovv` · branch `main`  
> **Último commit relevante:** `9bcfc0e` — suspendidas + match TikTok + scripts mapeo  
> **Producto:** Ads Holistic (`adsholistic.com` / deploy Vercel del proyecto)

---

## 0. Prompt listo para el otro Cursor

```
Leé docs/HANDOFF_CONTINUIDAD_2026-08-20.md completo antes de tocar nada.
Contexto: Hecom CRM + TikTok BM ya mapeados (SAFE + low revisado) y duplicados CRM limpios.
Código de cuentas suspendidas + nombres exactos ya en main (9bcfc0e).
No pegues secrets en el chat. Usá .env.local local (no está en git).
Prioridad: validar en prod/local Cuentas ads (Joseph Ramirez, Marko, Adriana) y decidir Whaticket / Ads Manager gerente.
Diseño: docs/SISTEMA_DISENO_HOLISTIC.md · Roles: docs/MAPA_DISENO_ROLES.md · Handoff viejo: docs/HANDOFF_TRABAJO_HOLISTIC.md
```

---

## 1. Qué se hizo (esta línea de trabajo)

### A. Código — cuentas ads
- Overview **muestra suspendidas/baneadas** (antes solo activas).
- UI: badge **Suspendida**, filtro, KPI suspendidas.
- **Pagos/Asignar** sigue sin fondear suspendidas (solo active/pending).
- Mapeo **ID-first** (`advertiser_id` Hecom); nombre TikTok live cuando existe.
- Filtra IDs Hecom **obsoletos** (ya no están en el BM).
- Match fuzzy tipográfico (`Rodrigez` ↔ `Rodriguez`).
- Archivos clave:
  - `lib/hecom/ad-accounts.server.ts`
  - `lib/hecom/advertiser-match.ts`
  - `lib/hecom/sync-approved-ad-accounts.server.ts`
  - UI en `features/ad-accounts/*`

### B. Datos Hecom CRM (live, proyecto `fsnolvozwcnbyuradiru`)
1. **Import SAFE** → `cliente_tiktok_cuentas`: **+51** filas (23 clientes, high/medium).
2. **Import low revisado** → **+4** filas:
   - Daniel Díaz Iparraguirre → 200/201/202
   - Jhosdan Rodriguez (canónico) → +201
3. **Limpieza duplicados** (soft-retire, no DELETE):
   - `Jhosdan Rodrigez` + `Jhosdan Rodrigez Calderon` → canónico **Jhosdan Rodriguez**
   - `Víctor Renzo Puerta` → canónico **Renzo Puerta**
   - Emails/phones vacíos en duplicados; nota `DUPLICATE_OF:…`; nombre `… [DUPLICADO]`

### C. Deploy
- Push a `main`: `9bcfc0e`
- Vercel debería haber redeployado solo. **QA humana pendiente** en prod.

---

## 2. Setup en la otra PC

```bash
git clone https://github.com/Atter12/Proyectovv.git   # o git pull si ya existe
cd Proyectovv
git pull origin main
npm ci
```

Crear **`.env.local`** (no está en git). Copiar variables de Vercel Production. Mínimo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
ENCRYPTION_KEY=
CRON_SECRET=
INTERNAL_JOB_SECRET=

HECOM_SUPABASE_URL=https://fsnolvozwcnbyuradiru.supabase.co
HECOM_SUPABASE_SERVICE_ROLE_KEY=

TIKTOK_APP_ID=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_ACCESS_TOKEN=
TIKTOK_DEFAULT_BC_ID=
TIKTOK_BC_FUNDING_ENABLED=true

# Stripe (ojo: en prod son LIVE)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

Formato: `KEY=value` sin espacios. `DATABASE_URL` con `$` en password → **entre comillas**.

```bash
npm run dev
```

Smoke conexiones (opcional):

```bash
node --env-file=.env.local -e "const {createClient}=require('@supabase/supabase-js');(async()=>{const h=createClient(process.env.HECOM_SUPABASE_URL,process.env.HECOM_SUPABASE_SERVICE_ROLE_KEY);const {count}=await h.from('clientes').select('*',{count:'exact',head:true});console.log('hecom clientes',count);})()"
```

---

## 3. Scripts útiles (ya en repo)

| Script | Uso |
|--------|-----|
| `scripts/export-hecom-name-only-map.mjs` | CSV Hecom↔TikTok (SAFE + full con confidence) |
| `scripts/import-hecom-tiktok-safe.mjs` | Inserta CSV en `cliente_tiktok_cuentas` (`--dry-run` / `--apply`, `--csv=…`) |
| `scripts/review-hecom-tiktok-low.mjs` | Separa low → APPROVED / REJECT |
| `scripts/cleanup-hecom-duplicates.mjs` | Soft-retire duplicados email (`--dry-run` / `--apply`) |
| `scripts/audit-hecom-tiktok-mapping.mjs` | Audit resumen mapeo |

Ejemplo:

```bash
node --env-file=.env.local scripts/export-hecom-name-only-map.mjs
node --env-file=.env.local scripts/import-hecom-tiktok-safe.mjs --csv=tmp/hecom-tiktok-name-only-map-SAFE.csv --dry-run
```

`tmp/` está en `.gitignore` (exports locales).

---

## 4. Estado del mapeo (números ~)

| Bucket | Estado |
|--------|--------|
| ID Hecom OK en BM | ~83+ (mejorado con imports) |
| SAFE importados | 51 filas |
| Low aprobados importados | +4 |
| Duplicados CRM retirados | 3 |
| Low **rechazados** (solo nombre de pila) | ~81 filas / ~19 clientes — **manual** |
| Sin match | ~18 — **manual** |
| Fabian Hoyos + Ecuador | **NO fusionar** (mismo email, cuentas PE/EC distintas) |
| Ocampo ≠ Ricaldi | Personas distintas |

---

## 5. Qué falta / siguiente prioridad

### P0 — Validar deploy (humano)
Con gerente o super admin:
- [ ] Cliente **Joseph Ramirez** / **Marko Villaizan** / **Alex Barra** → nombres exactos TikTok
- [ ] **Adriana Trujillo** → 200/201/202 (+ opcional mapear 205/206)
- [ ] Filtro **Suspendida** muestra baneadas
- [ ] Pagos: suspendidas **no** aparecen para Asignar
- [ ] Gerente sigue viendo Asignar (bug org; ver `docs/HANDOFF_TRABAJO_HOLISTIC.md`)

### P1 — Datos CRM restantes (manual u otro script cuidadoso)
- Revisar `tmp/hecom-tiktok-low-REVIEW.csv` (si se regenera) — no importar `REJECT`
- Mapear a mano clientes sin match / alias raros
- Migraciones Supabase Holistic si faltan en el entorno: `014_deposit_credit_amount_fee.sql`, `015_support_ticket_status_resolved.sql`

### P2 — Producto siguiente (acordado antes, no empezado)
1. **Whaticket API** → WhatsApp real en inbox soporte (hoy es chat interno estilo Whaticket).
2. **Panel gerente tipo Ads Manager** — lista BM + reportes + fondeo; **no** clonar TikTok 1:1. Cliente dejar como está.
3. Auth env si falta en Vercel: `AUTH_HECOM_OTP_LOGIN`, `AUTH_HECOM_OTP_STAFF_EMAILS`, `PAYMENTS_SUPER_ADMIN_EMAILS`, `ADMIN_ALLOWED_EMAILS`.

### No hacer aún
- Cripto 100% auto  
- Crear campañas embebidas  
- Crédito x2/x3/x5 auto  
- Borrar redirect `hecom.club`  
- Hard-delete clientes CRM duplicados (ya están soft-retirados)

---

## 6. Personas demo / QA

| Email | Rol | Fondeo |
|-------|-----|--------|
| `ferbasiliorengifo@gmail.com` | Cliente | Solo Stripe |
| `atlvbasiliorengifo@gmail.com` | Gerente | Solo cash BM |
| `attermayerbasiliorengifo@gmail.com` | Super admin | Dual |

---

## 7. Trampas (no romper)

1. No `includeSaldo: false` en layout sin alternativa.  
2. No cachear listas TikTok **vacías** 5 min.  
3. No asumir que gerente ve `ad_accounts` de la org del super admin.  
4. Diseño light Holistic naranja `#ff781f` — cero purple/dark SaaS.  
5. Fondeo BM **no** baja deuda Hecom (copy + lógica).  
6. **No** pegar service roles / Stripe live / TikTok tokens en el chat.  
7. Stripe en `.env` puede ser **LIVE** — cuidado en local.

---

## 8. Docs relacionados

| Doc | Para qué |
|-----|----------|
| `docs/HANDOFF_TRABAJO_HOLISTIC.md` | Bug gerente Asignar + KPIs Hecom |
| `docs/SISTEMA_DISENO_HOLISTIC.md` | Design system |
| `docs/MAPA_DISENO_ROLES.md` | Cliente / Gerente / Super admin |
| `docs/TIKTOK_BC_FUNDING.md` | Fondeo BM |
| `docs/PROXIMOS_PASOS.md` | Checklist MVP ops |
| **este archivo** | Continuidad 20-ago-2026 |

---

## 9. Una frase para el siguiente agente

> Ya están en `main` las cuentas suspendidas + match por ID/nombre; Hecom tiene ~55 mapeos nuevos y 3 duplicados soft-retirados. Siguiente: **QA en prod** de Cuentas ads, luego Whaticket o panel gerente tipo Ads Manager — sin reimportar filas `low` REJECT ni fusionar Fabian Ecuador / Ocampo-Ricaldi.
