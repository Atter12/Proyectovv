# Deploy profesional — configuración externa

Este documento es un resumen rápido. El checklist completo está en:

```txt
docs/PRODUCTION_EXTERNAL_CONFIG.md
```

## Orden recomendado

1. Crear ambientes separados: local, staging y production.
2. Configurar variables desde `.env.example`.
3. Aplicar migraciones `001` a `008` en staging.
4. Validar ledger con las queries del final de `006_professional_financial_ledger.sql`.
5. Configurar Supabase Auth/RLS/backups.
6. Configurar Stripe, Mercado Pago, Culqi y pago manual.
7. Configurar Resend y DNS del dominio remitente.
8. Crear app TikTok Business, registrar redirect URI y scopes.
9. Configurar jobs con `CRON_SECRET`/`INTERNAL_JOB_SECRET`.
10. Probar depósitos, asignaciones y gasto publicitario antes de usar credenciales live.

## Rutas productivas clave

```txt
/api/webhooks/payments/[provider]
/api/payments/allocations
/api/admin/payments/manual/[id]/approve
/api/integrations/tiktok/connect
/api/integrations/tiktok/callback
/api/integrations/tiktok/ad-accounts
/api/jobs/tiktok/sync
/api/jobs/ad-spend
```

## Principio financiero

El frontend nunca acredita saldo. Todo dinero real debe entrar por backend/webhook verificado y terminar en RPCs `ledger_*`.
