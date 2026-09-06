# TikTok Pixels — Ads Holistic (self-serve)

## Qué hace

En **Píxeles** (`/pixels`) el cliente (o gerente con cliente seleccionado) puede:

1. Elegir una cuenta ads (advertiser) del cliente Hecom.
2. **Crear píxel** (`POST /pixel/create/`) — **solo el píxel**, sin eventos. El cliente recibe **Pixel ID** / snippet y lo conecta a su tienda.
3. **Activar eventos** (`POST /pixel/event/create/`) — botón aparte, **después** de instalar el píxel en la tienda. Deja visibles ViewContent, AddToCart, CompletePayment, etc. en Events Manager.
4. **Traer de TikTok** (opcional): `GET /pixel/list/` si el píxel ya existía.
5. **Probar** eventos en el browser (`ttq.track`) y copiar el snippet.

IDs que se muestran / se pueden copiar: **Advertiser ID**, **Pixel ID**, **Pixel code** (si TikTok lo distingue del ID).

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

## Flujo recomendado (cliente)

1. Crear píxel → copiar Pixel ID / snippet.
2. Instalar en Shopify / landing (conectar tienda).
3. Activar eventos COD.
4. Probar en Events Manager → Test Events.

`POST /api/pixels` usa `setupCodEvents: false` por defecto (solo crea píxel). Los eventos van a `POST /api/pixels/events`.

## Quién puede usarlo

| Rol | Ver `/pixels` + sync | Crear píxel / eventos COD |
|-----|----------------------|---------------------------|
| Cliente (`advertiser`) | Sí (su cliente) | Sí |
| Gerente OTP (staff) | Sí (cliente seleccionado / “ver como”) | Sí (`adAccounts:create` vía staff) |
| Super admin / owner / admin | Sí | Sí |
| Viewer / finance puro (sin OTP staff) | Solo lectura si tiene `adAccounts:read` | No |

Scope: siempre el **cliente Hecom seleccionado**; el advertiser debe pertenecer a ese cliente.

## Permisos TikTok (importante)

Si la API responde `40001` / “No permission to operate advertiser”:

1. Correr (staff) el grant masivo:
   `node scripts/grant-tiktok-pixel-access.mjs`
   → asigna rol **ADMIN** del advertiser al usuario del `TIKTOK_ACCESS_TOKEN` en cada BC.
2. Después, **Crear píxel** suele funcionar aunque **Ver píxeles** (`/pixel/list`) siga en 40001 (quirk de TikTok: create/update OK, list no).
3. Si crear también falla: en Business Center → Members → Manage permissions → Pixels en esa cuenta ads.

Script: `scripts/grant-tiktok-pixel-access.mjs` (reintentable; salta advertisers donde `pixel/list` ya responde OK).

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
3. **Crear píxel** (sin eventos) → ver Pixel ID.
4. Instalar snippet / conectar tienda.
5. **Activar eventos**.
6. Cargar SDK → disparar ViewContent / CompletePayment.
7. En Events Manager → Test Events: deben aparecer.
8. Cliente A no puede operar advertiser de cliente B (API 400).

## Legacy

[marketingconholistic Pixel Activator](https://www.marketingconholistic.com/pixel-activator) solo dispara `ttq` con un ID ya creado. Self-serve de creación vive en Ads Holistic.
