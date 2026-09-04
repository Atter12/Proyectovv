# TikTok Pixels — Ads Holistic (self-serve)

## Qué hace

En **Píxeles** (`/pixels`) el cliente (o gerente con cliente seleccionado) puede:

1. Elegir una cuenta ads (advertiser) del cliente Hecom.
2. **Crear** un Pixel vía TikTok Open API (`POST /open_api/v1.3/pixel/create/`).
3. Registrar **eventos COD** (`POST /pixel/event/create/`).
4. **Listar / sync** desde TikTok (`GET /pixel/list/`).
5. **Probar** eventos en el browser (`ttq.track`) y copiar el snippet de instalación.
6. Verificar en [Events Manager → Test Events](https://ads.tiktok.com/i18n/events_manager).

Fuera de alcance (por ahora): Meta Pixel, CAPI server-side, pre-landing builder.

## Stack

| Pieza | Path |
|-------|------|
| TikTok client | `lib/integrations/tiktok/pixel.server.ts` |
| Eventos COD / browser | `lib/integrations/tiktok/pixel-events.shared.ts` |
| Persistencia + scope | `lib/pixels/tiktok-pixels.server.ts` |
| API | `GET/POST /api/pixels`, `POST /api/pixels/events` |
| UI | `app/(dashboard)/pixels`, `features/pixels/...` |
| Migración | `supabase/migrations/021_tiktok_pixels.sql` |

Token: mismo que finance BC — `TIKTOK_ACCESS_TOKEN` (agencia), vía `resolveTikTokFinanceAccessToken`.

## Permisos TikTok (importante)

Si la API responde:

`advertiser does not grant you /pixel/list/:GET permission` (code **40001**)

el token de la app **sí** llega al advertiser, pero **no tiene el recurso Pixels**.

En Business Center:

1. Settings → Members (o Partners) → usuario/app Holistic.
2. Cuenta ads afectada → **Manage permissions**.
3. Habilitar **Pixels** (y Measurement si aparece).
4. Reintentar Sync / Crear en Ads Holistic.

Sin ese grant, create/list fallan aunque funding BC funcione.

## Plantilla eventos COD

Definida en `COD_PIXEL_EVENT_DEFS`: ViewContent, AddToCart, InitiateCheckout, CompletePayment, CompleteRegistration, SubmitForm, Contact, ClickButton.

Si TikTok rechaza un `event_type`, el cliente intenta evento a evento y reporta `skipped`.

## Tests

```bash
# Unit (mock, sin red)
node scripts/test-tiktok-pixel-unit.mjs

# Smoke API real (list)
node --env-file=.env.local scripts/test-tiktok-pixel.mjs <advertiser_id>

# Create real (cuidado en prod)
node --env-file=.env.local scripts/test-tiktok-pixel.mjs <advertiser_id> --create --name "Holistic Test"
```

### Checklist QA manual

1. Seleccionar cliente con cuentas ads.
2. Ir a **Píxeles**.
3. Sync (si hay permiso) o Crear píxel + eventos COD.
4. Copiar snippet / Pixel ID.
5. Cargar SDK → disparar ViewContent / CompletePayment.
6. En Events Manager → Test Events: deben aparecer.
7. Cliente A no puede operar advertiser de cliente B (API 400).

## Legacy

[marketingconholistic Pixel Activator](https://www.marketingconholistic.com/pixel-activator) solo dispara `ttq` con un ID ya creado. Self-serve de creación vive en Ads Holistic.
