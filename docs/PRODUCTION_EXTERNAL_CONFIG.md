# Proyectovv — mapa de configuración externa para producción

Este documento lista las configuraciones externas necesarias para levantar el sistema con dinero real, emails transaccionales, cuentas publicitarias y jobs automáticos.

## 1. Ambientes

Mantener credenciales separadas para:

- `local`: desarrollo.
- `staging`: pruebas con sandbox/test mode.
- `production`: clientes y dinero real.

Variables base:

```env
APP_ENV=production
NEXT_PUBLIC_APP_URL=https://app.tudominio.com
NEXT_PUBLIC_SITE_NAME=Proyectovv
SUPPORT_EMAIL=soporte@tudominio.com
VALIDATE_ENV_AT_BUILD=false
```

`VALIDATE_ENV_AT_BUILD=false` permite compilar sin secretos live en CI. En runtime, la app sigue validando secretos cuando `APP_ENV` o `NODE_ENV` son production. Si quieres que el build falle cuando falten secretos, usa `VALIDATE_ENV_AT_BUILD=true`.

## 2. Supabase

Configurar:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_DATABASE_URL=
```

Checklist:

- Aplicar migraciones `001` a `008` en orden.
- Activar RLS y revisar políticas con Security Advisor.
- Activar backups/PITR si habrá dinero real.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` al navegador.
- Ejecutar movimientos financieros solo por backend/RPC.

## 3. Ledger financiero

Migración principal:

```txt
supabase/migrations/006_professional_financial_ledger.sql
```

Fuente de verdad:

```txt
ledger_accounts
ledger_journals
ledger_entries
ad_spend_transactions
v_wallet_ledger_balances
v_ad_account_ledger_balances
```

RPCs de uso productivo:

```txt
ledger_confirm_deposit
ledger_allocate_to_ad_account
ledger_reserve_ad_account_budget
ledger_release_ad_account_budget
ledger_record_ad_spend
ledger_refund_from_ad_account_to_wallet
ledger_reverse_journal
```

## 4. Seguridad y cifrado

Variables:

```env
ENCRYPTION_KEY=
INTERNAL_JOB_SECRET=
CRON_SECRET=
WEBHOOK_GLOBAL_SECRET=
ADMIN_ALLOWED_EMAILS=
```

Usos:

- `ENCRYPTION_KEY`: cifra tokens OAuth y credenciales de proveedores.
- `CRON_SECRET` / `INTERNAL_JOB_SECRET`: protege jobs internos.
- `WEBHOOK_GLOBAL_SECRET`: reserva para integraciones internas.
- `ADMIN_ALLOWED_EMAILS`: allowlist opcional para paneles internos.

## 5. Stripe

Variables:

```env
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_WEBHOOK_TOLERANCE_SECONDS=300
```

Webhook:

```txt
POST /api/webhooks/payments/stripe
```

Eventos mínimos:

```txt
checkout.session.completed
payment_intent.succeeded
payment_intent.payment_failed
charge.refunded
charge.dispute.created
```

Flujo productivo:

```txt
payment_intents.created
→ checkout Stripe
→ webhook firmado
→ validar monto/moneda/metadata
→ ledger_confirm_deposit
```

## 6. Mercado Pago

Variables:

```env
MERCADOPAGO_ACCESS_TOKEN=
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=
MERCADOPAGO_WEBHOOK_SECRET=
MERCADOPAGO_WEBHOOK_TOLERANCE_SECONDS=300
MERCADOPAGO_SUCCESS_URL=https://app.tudominio.com/payments?status=success
MERCADOPAGO_FAILURE_URL=https://app.tudominio.com/payments?status=failed
MERCADOPAGO_PENDING_URL=https://app.tudominio.com/payments?status=pending
```

Webhook:

```txt
POST /api/webhooks/payments/mercadopago
```

Regla: al recibir webhook, consultar el payment detail del proveedor antes de acreditar saldo.

## 7. Culqi

Variables:

```env
CULQI_PUBLIC_KEY=
CULQI_PRIVATE_KEY=
CULQI_WEBHOOK_SECRET=
CULQI_ENV=production
```

Webhook:

```txt
POST /api/webhooks/payments/culqi
```

Estado del código: adapter preparado para checkout/tokenización y webhook. Antes de live, completar el flujo específico de cargo con la modalidad Culqi elegida por tu comercio.

## 8. Pago manual

Variables:

```env
PAYMENTS_ALLOW_MANUAL_PROVIDER=true
PAYMENTS_MANUAL_ENABLED=true
```

Ruta de aprobación:

```txt
POST /api/admin/payments/manual/[id]/approve
```

Regla: solo `owner`, `admin` o `finance` pueden aprobar. La aprobación llama a `ledger_confirm_deposit`.

## 9. Resend / emails transaccionales

Variables:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM="Proyectovv <no-reply@tudominio.com>"
EMAIL_REPLY_TO=soporte@tudominio.com
```

DNS requerido:

```txt
SPF
DKIM
DMARC
Return-Path si aplica
```

Eventos auditados en `email_events`:

```txt
payment.manual.created
payment.deposit.succeeded
support.ticket.created
support.ticket.created.internal
```

## 10. TikTok Business API

Variables:

```env
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://app.tudominio.com/api/integrations/tiktok/callback
TIKTOK_AUTH_BASE_URL=https://business-api.tiktok.com/portal/auth
TIKTOK_API_BASE_URL=https://business-api.tiktok.com/open_api/v1.3
TIKTOK_SCOPES=
TIKTOK_WEBHOOK_SECRET=
```

Rutas:

```txt
GET /api/integrations/tiktok/connect
GET /api/integrations/tiktok/callback
GET /api/integrations/tiktok/ad-accounts
POST /api/integrations/tiktok/ad-accounts
POST /api/jobs/tiktok/sync
```

Flujo:

```txt
admin conecta TikTok
→ callback OAuth
→ exchange code por tokens
→ guardar tokens cifrados en integration_connections
→ importar advertiser accounts
→ crear/actualizar ad_accounts
```

## 11. Jobs internos

Rutas protegidas:

```txt
POST /api/jobs/tiktok/sync
POST /api/jobs/ad-spend
```

Headers aceptados:

```txt
Authorization: Bearer <CRON_SECRET>
x-cron-secret: <CRON_SECRET>
x-job-secret: <INTERNAL_JOB_SECRET>
```

Frecuencias recomendadas:

- TikTok sync: cada 15-60 minutos.
- Ad spend sync: cada 15-60 minutos.
- Reconciliación de pagos: cada 15-60 minutos.
- Alertas de saldo bajo: cada hora.

## 12. Storage

Buckets creados por migración `008` cuando existe schema `storage`:

```txt
payment-proofs       privado
creative-assets      privado
organization-logos   público
support-attachments  privado
```

Variables opcionales:

```env
STORAGE_PROVIDER=supabase
SUPABASE_STORAGE_BUCKET_CREATIVE_ASSETS=creative-assets
SUPABASE_STORAGE_BUCKET_PAYMENT_PROOFS=payment-proofs
```

## 13. Monitoreo

Variables:

```env
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
LOG_LEVEL=info
```

Alertas mínimas:

- Webhook de pago fallido.
- Ledger integrity mismatch.
- Token OAuth expirado.
- Job interno fallando.
- Intento de saldo negativo.
- Pago duplicado bloqueado por idempotencia.

## 14. Comandos de validación

```bash
npm install
npm run lint
npm run typecheck
NEXT_TELEMETRY_DISABLED=1 npm run build
```

Para forzar validación de secretos en build:

```bash
VALIDATE_ENV_AT_BUILD=true npm run build
```
