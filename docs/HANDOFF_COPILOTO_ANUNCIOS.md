# Handoff — Copiloto de anuncios con IA (Ads Holistic)

> Para el agente que retome esto. Leé todo antes de tocar código. Español Perú, tono directo.
> Fuente: propuesta `Propuesta-Copiloto-de-anuncios.pdf` (octubre 2026, 6 págs.), resumida abajo.
> Estado al 11/10/2026: **solo análisis, nada implementado.**
>
> **Actualización 11/10/2026 (noche):** Radar, receta, tabla por anuncio y Piloto ya están en `main`, apagados por defecto.
> El estado, el diseño y la guía para encenderlo paso a paso están en `docs/PLAN_PROFIT_RADAR.md` (sección 9.5).

## 1. Qué es

Usar los resultados reales de las cuentas TikTok que maneja Holistic para que cada vendedor
cree, pruebe y optimice anuncios que venden más. Ciclo de 4 piezas:

| # | Pieza | Hace | Ejemplo para el cliente |
|---|---|---|---|
| 1 | **Radar** (descubrir) | Detecta anuncios ganadores entre todas las cuentas (gasto creciendo varios días con buen costo por resultado) y extrae su "receta" con IA: gancho 0–3 s, duración, formato (testimonio, demo, presentador, unboxing), texto en pantalla, CTA, rubro. | "En ropa están ganando testimonios de 15 s con el precio en el gancho." |
| 2 | **Estudio** (replicar) | El cliente sube foto o describe el producto → 3 guiones (gancho, texto en pantalla, CTA) basados en recetas de su rubro; imagen/video si el costo lo permite. | Demo: foto → anuncio en 2 min. |
| 3 | **Predictor** (predecir) | Nota al creativo antes de gastar comparándolo con las recetas + referencias del rubro. Enlaza al video de educación cuando detecta un error común. | "Gancho débil: el producto no aparece en los primeros 3 s, 62/100." |
| 4 | **Piloto** (optimizar) | Vigila anuncios en vivo: ganador / pierde plata / agotado, y **propone** mover presupuesto. Los ganadores vuelven al Radar. | "Tu anuncio B consigue mensajes 3x más barato. ¿Le paso $20 del A?" |

Complementa al otro equipo (educación, referidos, soporte agendado): ellos enseñan, esto da resultados.

## 2. Reglas que no se negocian

1. **No toca pagos, cartera, recargas, cupo ni ledger.** Solo anuncios. (Ver memoria del proyecto: el dinero tiene reglas muy delicadas — prepago guard, Hecom, BM10/30 compartidas vs BM200/300 cash.)
2. **El Piloto nunca actúa solo**: propone y el cliente confirma.
3. **Privacidad**: todo agregado y anónimo, mínimo **5 cuentas por grupo**; nunca mostrar anuncio, producto ni nombre de otro cliente.
4. **Consentimiento**: el cliente acepta participar en el Radar.
5. Nunca imprimir `TIKTOK_ACCESS_TOKEN` ni service role keys. Nunca `NODE_TLS_REJECT_UNAUTHORIZED=0` (usar `--use-system-ca`).

## 3. Plan por fases (de la propuesta)

| Fase | Qué | Tiempo |
|---|---|---|
| **0.5 Datos base** | Rubro de cada cliente, consentimiento, línea base de costo por resultado. | 1 sem |
| **1 Radar** | Leer y guardar cada día métricas + video de cada anuncio con gasto; detectar ganadores; extraer receta con IA; mostrar al cliente qué funciona en su rubro. | 2–3 sem |
| 2 Estudio | 3 guiones por producto con recetas del rubro; imagen/video si el costo da. | 2 sem |
| 3 Predictor | Que el análisis **vea** el video (hoy solo transcribe audio), comparar con recetas, referencias del rubro, link a educación. | 2 sem |
| 4 Piloto | Propuestas de presupuesto entre anuncios con confirmación. | 2–3 sem |

**Recomendación acordada para arrancar:** Fase 0.5 + base de Fase 1 — tabla de métricas diarias por
anuncio, cron nocturno que la llene, y campo de rubro en el cliente. Lo que más tarda es juntar
historial, así que conviene empezar a guardarlo ya. Profit (`/profit`) puede mostrar el detalle por
anuncio con esa misma tabla y es donde naturalmente vive el Piloto.

Medición desde el día 1: costo por resultado antes/después vs. clientes del mismo rubro que no lo usan;
retención de video 2 s / 6 s; adopción; frecuencia y monto de recargas.

### Decisiones pendientes del equipo
1. Rubro: (A) lista cerrada en Hecom que llena el equipo, o (B) la IA lo deduce de la descripción y el equipo confirma. **Sugerencia: B** para no frenar el arranque.
2. Mínimo de cuentas por grupo (propuesta: 5).
3. Quién lidera cada pieza.
4. Qué videos de educación enlaza el Predictor (tabla `education_lessons` ya existe).

Descartado: estado de cuenta del cliente, empezar por el Estudio, Piloto automático, comparar entre países (todo es Perú hoy).

## 4. Datos de producción (medidos, no estimados)

- 57 clientes de Ads · 337 cuentas TikTok · 45–52 con gasto en los últimos 7–14 días · **0 clientes con rubro**.
- Con ~50 cuentas activas y mínimo 5 por grupo → alcanza para **4–6 rubros amplios** (moda, belleza, hogar, tecnología, servicios). Mostrarlo como "tendencias", no prometer precisión.
- **Límite TikTok: 10 QPS para toda la plataforma** (un solo token de agencia). El cron del Radar debe correr de madrugada (Lima) y no pisarse con los demás crons.
- Tablas que existen pero están **vacías** (verificado 11/10/2026): `campaign_daily_metrics`, `ad_account_daily_metrics`, `campaigns`. Revisá su esquema en `supabase/migrations/` antes de decidir si reusarlas o crear `ad_daily_metrics` nueva.

## 5. Código que ya existe (punto de partida)

**Next.js 16 con cambios incompatibles**: leé `node_modules/next/dist/docs/` antes de escribir código (ver `AGENTS.md`).

TikTok (Business API v1.3, token de agencia en `TIKTOK_ACCESS_TOKEN`):
- `lib/integrations/tiktok/ad-list.server.ts` — listado de anuncios.
- `lib/integrations/tiktok/campaign-performance.server.ts` — `fetchCampaignPerformanceForAdvertisers` (métricas por campaña, lo usa Profit). Buen modelo para el reporte por anuncio (`/report/integrated/get/` con `data_level=AUCTION_AD`).
- `lib/integrations/tiktok/client.server.ts` — `getTikTokDailySpend`, `syncTikTokAdvertiserSpend`.
- `lib/integrations/tiktok/ad-review.server.ts`, `advertiser-live.server.ts`.

Creativos (base del Predictor/Estudio):
- `lib/creatives/discover-tiktok-ads.server.ts` — `discoverRejectedAdsForAdvertisers`: hoy **solo guarda rechazados**. Ampliar a anuncios con gasto.
- `lib/creatives/analyze-creative.server.ts` — `analyzeCreativeWithOpenAi` (nota 0–100: claridad, marca, cumplimiento) y `buildAgentBriefWithOpenAi` (brief en texto).
- `lib/creatives/transcribe-video.server.ts` — transcripción de audio.
- `lib/creatives/process-jobs.server.ts`, `sync-ad-reviews.server.ts`, `reject-fix-hint.server.ts`.
- Tablas: `creative_assets`, `creative_analysis_jobs`, `creative_analysis_results`, `creative_publish_drafts`.
- Docs: `docs/TIKTOK_CREATIVES.md`, `docs/PLAN_CREATIVOS_REVIEW_Y_SUSPENSIONES.md`.

Profit:
- `app/(dashboard)/profit/page.tsx` → `features/profit/components/ProfitPageClient.client.tsx` (~2.400 líneas), `ProfitAdvisorBot.client.tsx`, `ProductPerformancePanel.client.tsx`.
- `lib/realprofit/` — `profit-snapshot.server.ts`, `holistic-spend.server.ts`, `profit-advisor.server.ts`, `product-performance.ts`, `burn-rate-signals.server.ts`, `client-score.ts`.

Clientes y cuentas:
- Cliente = Hecom (`clientes`, Supabase de Hecom vía `lib/hecom/supabase.server.ts`). Cuentas del cliente: `cliente_tiktok_cuentas` (advertiser_id, bm_bucket).
- En Ads: `ad_accounts` (`metadata.hecom_cliente_id`). Rubro: decidir si va en Hecom `clientes` o en Ads.
- BCs: BM10 `7652451146933698576`, BM30 `7564426417577148433`, BM200 `7575005779271614480`, BM300 `7680955666005196801`.

Crons: `vercel.json` (todos con `Bearer CRON_SECRET`). Ya corren cada 5–30 min: creative-analysis, creative-ad-review, creative-ad-discover, tiktok/sync, prepago-guard, tiktok/spend-snapshot, partner-commissions. Rutas en `app/api/jobs/`.

## 6. Convenciones del repo

- Migraciones nuevas en `supabase/migrations/` con el siguiente número (último: `060_partners_client_fee.sql`). Con RLS.
- i18n: `messages/{es,en,pt-BR}.json`; editar solo el bloque del namespace, no reformatear el archivo entero.
- Rutas nuevas: `config/routes.ts`, `config/navigation.ts`, `types/navigation.ts`, `proxy.ts` matcher.
- Supabase devuelve máximo 1000 filas: paginar con `.range()`.
- Antes de commit: `npx eslint <archivos>` y `npx tsc --noEmit -p .`. Commits en español, `fix(...)`/`feat(...)`.
- Scripts de soporte locales: `node --use-system-ca --import jiti/register --env-file=.env.local scripts/<x>.ts` con `JITI_ALIAS` (ver encabezado de cualquier `scripts/_*.ts`).

## 7. Primer entregable sugerido

1. Migración `ad_daily_metrics` (o reusar `campaign_daily_metrics` si calza): `advertiser_id, ad_id, adgroup_id, campaign_id, stat_date, spend, impressions, clicks, ctr, conversions, cost_per_conversion, video_play_actions, video_watched_2s, video_watched_6s, video_id, hecom_cliente_id`, PK `(ad_id, stat_date)`.
2. Cron `/api/jobs/tiktok/ad-metrics` 1 vez al día (madrugada Lima) que recorra las cuentas con gasto y haga upsert del día anterior + re-sincronice los últimos 3 días (TikTok ajusta métricas). Respetar QPS.
3. Campo `rubro` + `radar_consent` en el cliente, con la IA sugiriendo rubro y el gerente confirmando.
4. Vista simple en Profit: tabla de anuncios del cliente con gasto, CTR, costo por resultado y retención.
