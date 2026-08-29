# TikTok Creativos / Agent Pro

## Qué hace

En `/creative-analyzer` (Creativos):

1. Vinculás un upload a una cuenta ads TikTok de la org.
2. OpenAI analiza score, ganchos y riesgos de policy.
3. Agent Pro arma un **brief** (campaña / ad group / ad) en borrador.
4. Un humano **aprueba o rechaza**.
5. Si `TIKTOK_CREATIVE_PUBLISH_ENABLED=true`, “Aprobar y publicar” sube el media y crea Campaign → Ad Group → Ad en TikTok **en pausa** (`DISABLE`).

## Env

| Variable | Default | Uso |
|----------|---------|-----|
| `OPENAI_API_KEY` | — | Análisis + brief |
| `OPENAI_VISION_MODEL` | `gpt-4o-mini` | Modelo |
| `TIKTOK_CREATIVE_PUBLISH_ENABLED` | `false` | Gate de publish real |
| `TIKTOK_ACCESS_TOKEN` / OAuth org | — | Mismo token que finance |
| `CRON_SECRET` | — | Cron `/api/jobs/creative-analysis` |

## Scopes TikTok (publish)

Además de finance, la app necesita permisos de **Ads Management** + **Creative Management** (upload video/image, campaign/adgroup/ad create). Tras habilitar scopes: re-auth del token.

## APIs internas

- `POST /api/creative-assets` — upload + cola análisis (`adAccountId` opcional)
- `GET|POST /api/jobs/creative-analysis` — worker (cron / Bearer)
- `GET|POST /api/creative-drafts` — listar / approve / reject (`publish: true` para TikTok)

## Migración

`supabase/migrations/020_creative_agent_pro.sql` — columnas en `creative_assets` + tabla `creative_publish_drafts`.

Aplicar en Supabase antes de usar en prod.

## Fail-safe

- Si TikTok falla al publicar, el draft queda `failed` (no `published`).
- Sin flag de publish, “Aprobar” solo marca `approved` (no llama a TikTok).
