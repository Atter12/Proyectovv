---
tipo: informe
tags: [informe, investigacion, copiloto, tiktok, datos]
fecha: 2026-10-05
---

# Fase 0 del Copiloto: hoy no guardamos rendimiento por anuncio

Relevamiento previo a [[El Copiloto de anuncios arranca por el Radar de ganadores]].
Solo lectura: no se tocó código.

## Alcance

`features/creative-analyzer`, los jobs `creative-analysis`, `creative-ad-review`
y `creative-ad-discover`, `app/api/creative-assets`, `app/api/creative-drafts`,
`features/profit`, píxeles, lectura de gasto de TikTok y datos de clientes en
Hecom. Conteos medidos en producción el 2026-10-05.

## Hallazgos

| # | Hallazgo | Dónde |
|---|---|---|
| 1 | No se guarda ninguna métrica por anuncio, grupo ni campaña. Solo gasto diario por cuenta. | `ad_spend_transactions` |
| 2 | Las métricas por campaña de Profit se piden en vivo y viven 5 min en memoria. | `lib/integrations/tiktok/campaign-performance.server.ts` |
| 3 | `campaign_daily_metrics` y `ad_account_daily_metrics` existen pero nadie las escribe; `ad_id`/`campaign_id` de `ad_spend_transactions` van siempre vacíos. | migraciones 003 y 006 |
| 4 | Ya se leen los anuncios de TikTok (`/ad/get/`, `video_url`) pero solo se guardan los rechazados. | `lib/creatives/discover-tiktok-ads.server.ts` |
| 5 | El analizador de creativos transcribe con Whisper y puntúa con `gpt-4o-mini`; en video **no ve la imagen**, solo lo que se dice. | `lib/creatives/analyze-creative.server.ts` |
| 6 | La IA hoy genera un brief en texto; no genera guiones estructurados, imágenes ni videos. | `buildAgentBriefWithOpenAi` |
| 7 | Se publica en TikTok campaña, grupo y anuncio en pausa, detrás de un flag. | `lib/creatives/creative-publish.server.ts` |
| 8 | No hay rubro ni país del cliente. Hecom solo tiene `biz` (texto libre). El país está fijo en `PE` al crear cuentas. | `lib/hecom/clientes.server.ts`, `bc-create-profiles.ts` |
| 9 | 8 componentes del analizador son código muerto (incluido un Benchmark con métricas que nadie calcula). | `features/creative-analyzer/components` |
| 10 | TikTok limita la app a 10 consultas por segundo, compartidas por todos los jobs. | límite visto el 2026-10-03 |

## Datos medidos

- 57 clientes de Ads con 337 cuentas de TikTok.
- 45 a 52 cuentas con gasto en los últimos 7 a 14 días (piso: solo cuenta días con saldo asignado).
- 27 cuentas no son accesibles con el token de agencia.
- Rubro y anuncios activos: no se pueden medir hoy.

Con ~50 cuentas activas y un mínimo de 5 por grupo, el Radar alcanza para 4 a 6
rubros amplios en Perú.

## Qué falta leer de TikTok

- `/report/integrated/get/` con `data_level=AUCTION_AD` y `stat_time_day`: gasto,
  impresiones, clics, CTR, conversiones, CPA, mensajes y retención de video
  (2 s, 6 s, 25/50/75/100 %).
- Guardar `video_id`, duración y portada de **todos** los anuncios con gasto.
- `/advertiser/info/` con industria y país, o un campo de rubro en Hecom.
- Los permisos actuales (Reporting, Ads Management, Creative Management) bastan.

## Qué sigue

- [ ] Decidir cómo se registra el rubro (lista en Hecom o IA + confirmación).
- [ ] Confirmar el mínimo de cuentas por grupo (propuesto: 5).
- [ ] Fase 0.5: rubro, consentimiento y línea base de costo por resultado.
- [ ] Fase 1: Radar.
