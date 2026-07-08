# Integración Web Cliente + Panel Admin

Este repo integra la web/app de cliente y el panel administrativo en una sola base Next.js, tomando como base el proyecto web porque contiene la configuración principal, rutas de autenticación, servicios, Supabase y migraciones existentes.

## Estructura principal

- `/overview`, `/payments`, `/ad-accounts`, `/affiliates`, `/creative-analyzer`: app cliente original.
- `/admin`: entrada del panel administrativo, redirige a `/admin/overview`.
- `/admin/overview`, `/admin/organizations`, `/admin/users`, `/admin/payments`, `/admin/refunds`, `/admin/ad-accounts`, `/admin/support`, `/admin/affiliates`, `/admin/creatives`, `/admin/ledger`, `/admin/reconciliation`, `/admin/webhooks`, `/admin/audit`, `/admin/integrations`, `/admin/settings`: módulos administrativos integrados.
- `lib/admin`: lógica server-side del panel admin.
- `components/admin`: shell, navegación y componentes visuales del panel admin.
- `supabase/migrations/010_admin_panel_optional_indexes.sql`: migración opcional de índices para el admin.

## Variables nuevas para admin

En producción se debe configurar al menos una de estas variables para habilitar acceso administrativo:

```env
ADMIN_ALLOWED_EMAILS=correo1@dominio.com,correo2@dominio.com
ADMIN_ALLOWED_USER_IDS=uuid_usuario_1,uuid_usuario_2
CUSTOMER_APP_URL=https://tu-dominio-cliente.com
```

En desarrollo, si no configuras allowlist, el admin permite cualquier usuario autenticado para facilitar pruebas locales. En producción se bloquea si no hay allowlist.

## Validación realizada

```bash
npm run typecheck
```

Resultado: TypeScript OK.

También se inició `next build`; la compilación y TypeScript terminaron correctamente, pero el proceso quedó detenido en `Collecting page data` dentro del sandbox. No se incluyó `node_modules` ni `.next` en el zip final.

## Nota de rutas

Para evitar choque entre la app cliente y el admin, el panel administrativo fue integrado bajo el prefijo `/admin`. Esto permite mantener ambas lógicas en un solo repo sin duplicar rutas como `/overview`, `/payments` o `/ad-accounts`.
