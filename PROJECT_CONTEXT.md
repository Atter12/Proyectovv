# Proyectovv — Contexto técnico actualizado

Proyecto Next.js 16 + Supabase para un SaaS/adtech multi-tenant con cartera financiera, pagos, cuentas publicitarias, soporte, notificaciones, ledger profesional e integraciones externas.

## Estado actual

| Área | Estado |
|---|---|
| Frontend dashboard | App Router, Server Components y componentes cliente para UX |
| Auth | Supabase Auth + sesión server-side |
| Multi-tenant | `organizations` + `organization_memberships` |
| Pagos | Adapters para Stripe, Mercado Pago, Culqi y manual |
| Ledger financiero | Migración `006_professional_financial_ledger.sql` con doble entrada, saldos derivados y RPCs |
| Email transaccional | Preparado para Resend con auditoría en `email_events` |
| TikTok Business API | OAuth, callback e importación de advertiser accounts con credenciales cifradas |
| Jobs | Endpoints protegidos para sync TikTok y registro de gasto publicitario externo |
| Storage | Buckets base preparados en `008_external_providers_ready.sql` |

## Migraciones importantes

Ejecutar en orden:

```bash
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_payments_rpc_webhooks_views.sql
supabase/migrations/003_align_professional_schema.sql
supabase/migrations/004_performance_views.sql
supabase/migrations/005_page_summary_views.sql
supabase/migrations/006_professional_financial_ledger.sql
supabase/migrations/007_external_integrations_notifications.sql
supabase/migrations/008_external_providers_ready.sql
```

La migración `006` convierte la wallet en un ledger profesional:

- `ledger_accounts`
- `ledger_journals`
- `ledger_entries`
- `ad_spend_transactions`
- vistas `v_wallet_ledger_balances` y `v_ad_account_ledger_balances`
- RPCs financieras `ledger_*`

Después de aplicar `006`, la fuente de verdad financiera es:

```txt
v_wallet_ledger_balances
v_ad_account_ledger_balances
ledger_journals
ledger_entries
ad_spend_transactions
```

Las columnas legacy `wallets.balance_cents`, `wallets.reserved_balance_cents` y `ad_account_balances.*` quedan como cache/compatibilidad.

## Flujos financieros

### Depósito

```txt
payment_intents.created
→ proveedor externo crea checkout
→ webhook verificado
→ processSuccessfulPaymentIntent()
→ ledger_confirm_deposit()
→ payment_intents.succeeded
→ email payment.deposit.succeeded
```

### Depósito manual

```txt
payment_intents.created(provider=manual)
→ email payment.manual.created
→ revisión/aprobación admin
→ POST /api/admin/payments/manual/[id]/approve
→ ledger_confirm_deposit()
```

### Asignación a cuenta publicitaria

```txt
POST /api/payments/allocations
→ valida sesión + permisos
→ verifica que ad_account pertenezca a la organización activa
→ ledger_allocate_to_ad_account()
→ actualiza saldos derivados/cache
```

### Gasto publicitario

```txt
job/API de proveedor Ads
→ POST /api/jobs/ad-spend
→ ledger_record_ad_spend()
→ ad_spend_transactions
→ ledger_journals + ledger_entries
```

## Integraciones externas preparadas

### Resend

Archivos:

```txt
lib/email/email.server.ts
lib/email/templates/payments.ts
```

Variables:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM="Proyectovv <no-reply@tudominio.com>"
EMAIL_REPLY_TO=soporte@tudominio.com
```

Templates implementados:

```txt
payment.manual.created
payment.deposit.succeeded
```

### TikTok Business API

Archivos:

```txt
lib/integrations/tiktok/oauth.server.ts
lib/integrations/tiktok/client.server.ts
app/api/integrations/tiktok/connect/route.ts
app/api/integrations/tiktok/callback/route.ts
app/api/integrations/tiktok/ad-accounts/route.ts
app/api/jobs/tiktok/sync/route.ts
```

Variables:

```env
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://app.tudominio.com/api/integrations/tiktok/callback
TIKTOK_API_BASE_URL=https://business-api.tiktok.com/open_api/v1.3
TIKTOK_AUTH_BASE_URL=https://business-api.tiktok.com/portal/auth
TIKTOK_SCOPES=
```

Los tokens se guardan cifrados con `ENCRYPTION_KEY` en `integration_connections.encrypted_credentials`.

### Pagos

Archivos:

```txt
lib/payments/providers/stripe.provider.ts
lib/payments/providers/mercadopago.provider.ts
lib/payments/providers/culqi.provider.ts
lib/payments/providers/manual.provider.ts
app/api/webhooks/payments/[provider]/route.ts
```

Regla obligatoria: ningún proveedor acredita saldo desde frontend. Solo webhooks/backend verificados llaman a `ledger_confirm_deposit()`.

## Variables mínimas de producción

Ver `.env.example`. Las imprescindibles son:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=
INTERNAL_JOB_SECRET=
CRON_SECRET=
```

En producción, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY` y secretos de proveedores nunca deben exponerse al navegador.

## Rutas API relevantes

```txt
/api/payments/intents
/api/payments/intents/[id]
/api/payments/allocations
/api/payments/transactions
/api/admin/payments/manual/[id]/approve
/api/webhooks/payments/[provider]
/api/integrations/tiktok/connect
/api/integrations/tiktok/callback
/api/integrations/tiktok/ad-accounts
/api/jobs/tiktok/sync
/api/jobs/ad-spend
/api/support/tickets
```

## Seguridad operativa

- Mantener RLS activado.
- No escribir directamente en tablas financieras desde cliente.
- Usar RPCs `ledger_*` para movimientos de dinero.
- Verificar firma y consultar proveedor antes de confirmar depósitos.
- Cifrar tokens OAuth con `ENCRYPTION_KEY`.
- Usar `CRON_SECRET`/`INTERNAL_JOB_SECRET` para jobs.
- Auditar pagos, emails, webhooks y aprobaciones manuales.

## Validación realizada en este paquete

```bash
npm run lint
npm run typecheck
NEXT_TELEMETRY_DISABLED=1 npm run build
```

El build pasa sin credenciales live porque `VALIDATE_ENV_AT_BUILD=false` es el default. En producción runtime, los secretos obligatorios siguen siendo validados.

Resultado: lint, typecheck y build correctos.

## Checklist antes de producción

1. Aplicar migraciones en staging.
2. Ejecutar queries de validación al final de `006_professional_financial_ledger.sql`.
3. Configurar `.env` por ambiente.
4. Configurar webhooks de Stripe/Mercado Pago/Culqi.
5. Verificar Resend + DNS SPF/DKIM/DMARC.
6. Crear app TikTok Business y registrar redirect URI.
7. Configurar jobs protegidos por `CRON_SECRET`.
8. Probar depósitos, asignaciones y webhooks con datos sandbox.
9. Habilitar logs, alertas y backups.
