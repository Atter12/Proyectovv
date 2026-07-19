# Roadmap MVP — Proyectovv (Hecom Club)

**Objetivo:** salir del flujo 100% manual de *Credito Holistic* (gastos, recargas y cobros a mano) y tener un MVP usable donde clientes recargan, ven saldo/gasto y el admin opera con control real.

**Estado del código:** base fuerte (Next.js 16 + Supabase + ledger + pagos + panel admin + OAuth TikTok).  
**Estado del negocio:** clientes ya existen; hoy todo se opera a mano.

**App TikTok ya creada:** `Hecom Club Spend Sync` (Approved / Online) con scopes de Ad Account Management, Ads Management y Reporting. Credenciales van solo en env (nunca en el repo).

---

## Visión del producto (núcleo, no negociable)

Cada cliente tiene **su propio dashboard** para operar de forma autónoma:

- **Recargar saldo** (tarjeta y manual con aprobación).
- **Subir / gestionar sus campañas**.
- **Ver sus recargas y sus gastos** en un solo lugar, claro y ordenado.

Todo el MVP gira alrededor de esta experiencia: un panel propio por cliente donde recarga, sube campañas y controla su gasto.

---

## Definición de MVP (qué sí / qué no)

### Sí entra en MVP

1. Auth + organización (cliente) y panel admin.
2. Wallet con saldo real (ledger).
3. Recarga: **tarjeta (Stripe)** + **pago manual con comprobante** (transferencia / USDT aprobado por admin).
4. Asignar saldo a cuentas publicitarias.
5. Ver gasto de TikTok sincronizado (cron) → baja del saldo.
6. Migrar / dar de alta clientes actuales de Credito Holistic.
7. Aprobación admin de pagos manuales + vista de ledger/conciliación básica.

### No entra en MVP (fase 2+)

- Recarga cripto 100% automática (detección on-chain sin revisión).
- Crear campañas desde la plataforma (Ads Manager embebido).
- Crédito x2/x3/x5 con scoring (puede quedar como flag manual admin).
- Afiliados con liquidación automática (puede quedar tracking + cálculo manual).
- Mercado Pago / Culqi en producción (código existe; priorizar Stripe + manual).
- Multi-plataforma ads (Meta, etc.).

---

## Gap vs Credito Holistic (hoy)

| Hoy (manual) | MVP Proyectovv |
|---|---|
| Anotan gasto a mano | Job TikTok Reporting → `/api/jobs/ad-spend` → ledger |
| Recargan saldo a mano | Cliente crea intent → webhook Stripe **o** admin aprueba manual |
| Cobran / liquidan a mano | Wallet + fee en depósito + vista admin de pagos |
| Cuentas y BMs en Excel/chat | `ad_accounts` + import OAuth TikTok |
| Sin portal cliente | Dashboard: overview, payments, ad-accounts |

---

## Fases

### Fase 0 — Entorno listo (1–2 días)

- [ ] Confirmar proyecto Vercel + proyecto Supabase de staging/prod.
- [ ] Aplicar migraciones `001` → `011` en Supabase (orden documentado en `PROJECT_CONTEXT.md`).
- [ ] Completar `.env` / Vercel env: Supabase, `ENCRYPTION_KEY`, `CRON_SECRET` / `INTERNAL_JOB_SECRET`, `NEXT_PUBLIC_APP_URL`.
- [ ] Configurar TikTok en env:
  - `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` (app **Hecom Club Spend Sync**)
  - `TIKTOK_REDIRECT_URI` = `{APP_URL}/api/integrations/tiktok/callback`
  - Registrar la misma redirect URI en el portal TikTok for Business.
- [ ] Stripe sandbox: keys + webhook → `/api/webhooks/payments/stripe`.
- [ ] Smoke: login, crear org, ver dashboard vacío.

**Criterio de salida:** app desplegada, migraciones OK, login funciona.

---

### Fase 1 — Dinero (recargas) — prioridad #1 (3–5 días)

Sin esto no se reemplaza Credito Holistic.

- [ ] Flujo Stripe end-to-end en sandbox: intent → checkout → webhook → `ledger_confirm_deposit`.
- [ ] Flujo manual: cliente sube comprobante → admin aprueba (`/api/admin/payments/manual/[id]/approve`) → acredita.
- [ ] Fee de plataforma configurable (ej. 4% tarjeta) **incluido** en el monto mostrado al cliente.
- [ ] UI cliente: wallet + historial de transacciones + “Recargar”.
- [ ] UI admin: cola de pagos pendientes, detalle, approve/reject.
- [ ] Emails mínimos (Resend): depósito exitoso + “pago manual recibido / en revisión”.

**Criterio de salida:** un cliente de prueba puede recargar y ver saldo; admin puede aprobar una transferencia.

---

### Fase 2 — Cuentas TikTok + gasto automático — prioridad #2 (4–6 días)

Hoy el repo **importa advertisers** (`/api/jobs/tiktok/sync`) pero el gasto llega por push a `/api/jobs/ad-spend`. Falta el puente Reporting → spend.

- [ ] Completar OAuth TikTok en UI (Connect) y guardar tokens cifrados.
- [ ] Importar advertiser accounts a `ad_accounts` y vincularlos a la org del cliente.
- [ ] Implementar pull de **Reporting** (scope ya aprobado en la app) por advertiser/día.
- [ ] Cron Vercel (o scheduler) cada X horas:
  1. sync advertisers
  2. fetch spend
  3. POST interno a `/api/jobs/ad-spend` (idempotente por `externalSpendId`)
- [ ] Dashboard: gasto diario / total / saldo disponible por cuenta.
- [ ] Regla MVP: si saldo insuficiente → alertar admin (bloqueo hard puede ser fase 2.1).

**Criterio de salida:** una cuenta TikTok real refleja gasto del día sin escribirlo a mano.

---

### Fase 3 — Migración desde Credito Holistic (2–4 días)

- [ ] Inventario de clientes actuales: org, contacto, saldo pendiente, cuentas/BMs TikTok, modalidad (prepago vs crédito informal).
- [ ] Script o admin UI de alta masiva: users + organizations + memberships.
- [ ] Carga inicial de saldo vía **depósito manual aprobado** (auditoría en ledger, no UPDATE directo a balance).
- [ ] Mapear cada advertiser ID a `ad_accounts` y conectar OAuth (cliente o admin).
- [ ] Periodo paralelo: Credito Holistic + Proyectovv (1–2 semanas) para validar números.
- [ ] Cutover: nuevos movimientos solo en Proyectovv.

**Criterio de salida:** al menos N clientes piloto operando solo en Proyectovv sin Excel de gastos.

---

### Fase 4 — Operación admin mínima (2–3 días)

- [ ] Overview admin: saldos, depósitos del día, gasto del día, pagos pendientes.
- [ ] Ledger / reconciliation views usables (ya hay rutas admin; pulir lo crítico).
- [ ] Soporte tickets básico (si un piloto lo necesita).
- [ ] Roles: solo staff con acceso admin; RLS verificado en staging.
- [ ] Checklist seguridad: service role solo server, webhooks firmados, jobs con `CRON_SECRET`.

**Criterio de salida:** el equipo puede operar el día a día sin tocar SQL a mano.

---

### Fase 5 — Soft launch MVP (1–2 días)

- [ ] 3–5 clientes piloto (idealmente los que más recargan / más gasto tienen).
- [ ] Documentar SOP interno: cómo aprobar pago manual, cómo conectar TikTok, qué hacer si falla sync.
- [ ] Alertas: fallo de cron, webhook fallido, discrepancia ledger.
- [ ] Congelar scope: no meter Ads Manager ni cripto auto hasta estabilizar.

**Criterio de salida:** MVP en producción con piloto estable ≥ 7 días.

---

## Orden recomendado de trabajo (semana a semana)

| Semana | Foco |
|---|---|
| 1 | Fase 0 + Fase 1 (Stripe + manual) |
| 2 | Fase 2 (TikTok spend sync real) |
| 3 | Fase 3 (migración piloto) + Fase 4 |
| 4 | Fase 5 soft launch + fixes |

Si el equipo es 1–2 devs, no paralelizar demasiado: **dinero primero, luego sync de gasto**.

---

## Decisiones MVP (cerrarlas ya)

1. **Métodos de recarga en v1:** Stripe + manual (transferencia / USDT con aprobación).  
2. **Crédito x2/x3/x5:** fuera de automatización; si hace falta, flag manual por org en admin.  
3. **Fee:** un % por método, visible y auditado en ledger.  
4. **Fuente de verdad de gasto TikTok:** Reporting API de la app *Hecom Club Spend Sync*, no Excel.  
5. **Credito Holistic:** deja de recibir movimientos nuevos tras cutover de cada piloto.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Scope Reporting insuficiente para el breakdown que quieren | Validar endpoint/report que usa la app aprobada en sandbox antes de prometer UI |
| Números no cuadran vs Credito Holistic | Periodo paralelo + conciliación diaria |
| Tokens TikTok vencen | Refresh + re-auth en UI + alerta admin |
| Aprobar pagos manuales tarde | Cola admin + notificación |
| Escribir saldo “a mano” en DB | Prohibido; solo RPCs `ledger_*` |

---

## Checklist “MVP listo”

- [ ] Cliente recarga (Stripe o manual aprobado) y ve saldo.
- [ ] Cliente ve cuentas TikTok y gasto del día sin carga manual.
- [ ] Admin aprueba pagos y ve ledger coherente.
- [ ] Al menos 1 org piloto migrada desde Credito Holistic.
- [ ] Cron de sync + spend corriendo en Vercel.
- [ ] Secretos solo en Vercel/Supabase; app TikTok Online + callback correcto.

---

## Siguiente acción inmediata

1. Configurar env TikTok (`Hecom Club Spend Sync`) + Stripe sandbox en Vercel.  
2. Aplicar migraciones en Supabase si faltan.  
3. Empezar **Fase 1** (recargas) en paralelo a un spike corto de **Reporting → ad-spend** (Fase 2).

Cuando quieras, el siguiente paso de implementación concreto es: cablear el job de Reporting TikTok → `/api/jobs/ad-spend`, o cerrar el flujo Stripe sandbox end-to-end.
