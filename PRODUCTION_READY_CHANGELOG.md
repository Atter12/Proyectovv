# Proyectovv production-ready package

## Cambios principales

- Integrada migración `006_professional_financial_ledger.sql` con ledger financiero de doble entrada.
- Añadidas migraciones `007_external_integrations_notifications.sql` y `008_external_providers_ready.sql`.
- Pagos migrados a flujo profesional: webhooks verificados → `processSuccessfulPaymentIntent()` → `ledger_confirm_deposit()`.
- Añadida asignación real de saldo a cuentas publicitarias con `POST /api/payments/allocations`.
- Añadido endpoint de aprobación de pagos manuales: `POST /api/admin/payments/manual/[id]/approve`.
- Preparado Resend para emails transaccionales y auditoría en `email_events`.
- Preparado TikTok Business API: OAuth, callback, almacenamiento cifrado de tokens e importación de advertiser accounts.
- Añadido endpoint protegido para registrar gasto publicitario externo: `POST /api/jobs/ad-spend`.
- Lecturas de dashboard, wallet, pagos y ad accounts migradas hacia vistas de ledger con fallback legacy.
- Añadida plantilla `.env.example` completa.
- Añadidos `eslint.config.mjs`, `package-lock.json` y documentación de producción.

## Validación local realizada

```bash
npm run validate
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
SUPABASE_SERVICE_ROLE_KEY=dummy \
ENCRYPTION_KEY=dummy \
INTERNAL_JOB_SECRET=dummy \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
npm run build
```

Resultado: correcto.

## Primeros pasos después de descomprimir

```bash
npm install
cp .env.example .env.local
npm run dev
```

Antes de producción, aplicar migraciones en staging y configurar los proveedores externos descritos en `docs/PRODUCTION_EXTERNAL_CONFIG.md`.
