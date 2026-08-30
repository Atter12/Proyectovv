# TikTok Creativos / Agent Pro

## Flujo cliente (Ads Holistic)

1. **Creativos** → elegí cuenta **Aprobada** → subí video/imagen.
2. OpenAI scorea + Agent Pro arma brief (campaña / ad group / ad).
3. Botón **Enviar campaña a TikTok** → upload media + crea estructura **en pausa**.
4. En Ads Manager alguien la prende (no gasta sola).

No hace falta que el cliente conecte su TikTok: usa el token/BM de la agencia.

## Env

| Variable | Default | Uso |
|----------|---------|-----|
| `OPENAI_API_KEY` | — | Análisis + brief |
| `OPENAI_VISION_MODEL` | `gpt-4o-mini` | Modelo |
| `TIKTOK_CREATIVE_PUBLISH_ENABLED` | `false` | **Obligatorio `true`** para el botón TikTok |
| `TIKTOK_ACCESS_TOKEN` / OAuth org | — | Mismo token que finance |
| `CRON_SECRET` | — | Cron `/api/jobs/creative-analysis` |

## Scopes TikTok (publish)

App necesita **Ads Management** + **Creative Management**. Tras habilitar: regenerar token.

## APIs

- `POST /api/creative-assets` — upload + cola análisis (pide `adAccountId`)
- `GET|POST /api/jobs/creative-analysis` — worker
- `GET|POST /api/creative-drafts` — `approve` / `reject` / `publish`

## Migración

`supabase/migrations/020_creative_agent_pro.sql`

## Fail-safe

- TikTok falla → draft `failed` (reintentar con Enviar).
- Sin flag publish → UI muestra el botón deshabilitado + aviso ops.
