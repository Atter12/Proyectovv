# TikTok Creativos / Agent Pro

## Flujo cliente (Ads Holistic)

1. **Creativos** → elegí cuenta **Aprobada** → subí video/imagen.
2. OpenAI scorea + Agent Pro arma brief (campaña / ad group / ad).
3. Botón **Enviar campaña a TikTok** → upload media + crea estructura **en pausa**.
4. Cron **review** consulta `/ad/review_info/` → si TikTok rechaza el anuncio, Creativos muestra **motivos** + CTA “Subir corregido”.
5. En Ads Manager alguien prende campañas aprobadas (no gastan solas).

No hace falta que el cliente conecte su TikTok: usa el token/BM de la agencia.

## Env

| Variable | Default | Uso |
|----------|---------|-----|
| `OPENAI_API_KEY` | — | Análisis + brief |
| `OPENAI_VISION_MODEL` | `gpt-4o-mini` | Modelo |
| `TIKTOK_CREATIVE_PUBLISH_ENABLED` | `false` | **Obligatorio `true`** para el botón TikTok |
| `TIKTOK_ACCESS_TOKEN` / OAuth org | — | Mismo token que finance |
| `CRON_SECRET` | — | Cron `/api/jobs/creative-analysis` y `/api/jobs/creative-ad-review` |

## Scopes TikTok (publish + review)

App necesita **Ads Management** + **Creative Management**. Tras habilitar: regenerar token.

## APIs

- `POST /api/creative-assets` — upload + cola análisis (pide `adAccountId`)
- `GET|POST /api/jobs/creative-analysis` — worker análisis IA
- `GET|POST /api/jobs/creative-ad-review` — polling review TikTok (motivos de rechazo)
- `GET|POST /api/creative-drafts` — `approve` / `reject` / `publish`

## Migraciones

- `020_creative_agent_pro.sql` — drafts + assets
- `030_creative_ad_review.sql` — `review_status`, `reject_reasons`, `secondary_status`
- `031_creative_parent_draft.sql` — `parent_draft_id` (corrección ligada al rechazo)

## Fail-safe

- TikTok publish falla → draft `failed` (reintentar con Enviar).
- Sin flag publish → UI muestra el botón deshabilitado + aviso ops.
- Review rechazado → draft sigue `published` + badge “Rechazado por TikTok” (no es rechazo Holistic del brief).

## Plan

`docs/PLAN_CREATIVOS_REVIEW_Y_SUSPENSIONES.md` — caso A (creativo) vs B (cuenta).
