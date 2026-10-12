# Plan: Radar dentro de Profit (Copiloto de anuncios)

**Estado:** fases 1 y 2 (backend) en `main` · 11 de octubre de 2026 · ver también `docs/HANDOFF_COPILOTO_ANUNCIOS.md`
**Origen:** propuesta "Copiloto de anuncios con IA" (PDF, octubre 2026), conversación del equipo
(Atter, Claudio) e investigación de la API de TikTok
([página para el equipo](https://claude.ai/artifact/BAEwdJvqHze2zHYhYcc4PF)).

**En una frase:** el cliente entra a Profit, elige sus categorías, ve videos que hoy funcionan en
TikTok para su rubro, marca los que le gustan, y Profit le arma una **receta única** (gancho,
estructura, guiones) para que su video sea original pero siga lo que funciona.

---

## 0. Reglas que no se negocian

1. **Dentro de Profit, sin sección nueva en el menú.** Indicación de Atter. Profit es la base de
   las estadísticas; el Radar se suma ahí y de paso se mejora el diseño de Profit.
2. **Receta, no copia.** El sistema nunca le dice al cliente que copie un video. Analiza los
   videos elegidos, junta sus rasgos y genera ideas propias. Un filtro anti-copia revisa cada idea.
3. **El sistema busca los videos solo**, de acuerdo al cliente. Vía oficial: Discovery API de
   TikTok (sección 5). Nada de scraping.
4. **Los videos no se descargan ni se guardan.** Se muestran con el reproductor oficial de TikTok
   (`tiktok.com/player/v1/{id}`) y un botón "Ver en TikTok". Solo guardamos el enlace y las
   etiquetas.
5. **Si un video muere, se reemplaza en silencio.** El cliente nunca ve un error.
6. **Datos de un cliente nunca se le muestran a otro.** Del rendimiento de nuestros clientes solo
   salen recetas agregadas con un mínimo de 5 cuentas por grupo. (Términos de desarrollador de
   TikTok, cláusula D.2.)
7. **No toca pagos, cartera ni recargas.** El futuro Piloto propone y el cliente confirma.
8. **Respeta los límites de TikTok:** cola con freno, procesos diarios que guardan en la base, y
   Profit lee de la base en vez de consultar TikTok en cada visita.

---

## 1. Flujo del cliente

```
Primera visita a Profit
   │
   ├─ 1. Categorías (ya vienen marcadas con lo que sabemos del cliente; confirma o corrige)
   │      + "¿Quién puede salir en tus videos?"  + objetivo (mensajes / ventas / seguidores)
   │
   ├─ 2. Ronda amplia: ~12 videos variados de su rubro (distintos formatos, tonos y estilos)
   │      → marca "me gusta" / "no me gusta"
   │
   ├─ 3. Profit arma su perfil de gusto
   │
   ├─ 4. Ronda reducida: ~8 videos filtrados con su perfil → elige uno, varios o todos
   │
   ├─ 5. Receta única: gancho, estructura, formato, duración, texto en pantalla, llamado a la
   │      acción + 3 guiones para su producto + "por qué" de cada parte
   │
   └─ 6. Estadísticas: Profit mide su video (y lo que funcione ajusta su perfil)
```

- Todo el arranque debe tomar **menos de 2 minutos** y se puede saltar.
- El perfil se puede **editar y repetir** (producto nuevo, o cuando su estilo no funciona).
- "No me gusta" también enseña.

### Perfil inicial (antes de la ronda 1)

Profit ya sabe bastante del cliente. Una llamada a la IA arma el perfil sugerido con:

| Dato | Fuente en el código |
|---|---|
| Giro del negocio y notas del equipo | Hecom `clientes.biz`, `clientes.notes` (`lib/hecom/clientes.server.ts`) |
| Instagram | Hecom `clientes.ig` |
| Productos que anuncia | Nombres de campañas → `productFromCampaignName` (`lib/realprofit/product-performance.ts`) |
| Tienda, precios y ticket | Real Profit `rp_stores.shop_domain`, `rp_orders` (`lib/realprofit/profit-snapshot.server.ts`) |
| Estilo de sus videos actuales | Transcripciones y análisis de Creativos (`creative_analysis_results.raw_output`) |
| Qué le funciona | Métricas por campaña de Profit (`ProfitAnalysis.campaigns`) |

Salida: rubro sugerido (categoría Discovery), productos, objetivo probable, estilo actual.

### Qué aprende el perfil de gusto

Cada video de la biblioteca lleva etiquetas; cada "me gusta" suma peso a sus etiquetas y cada
"no me gusta" resta. Modelo simple y explicable (pesos por etiqueta), sin entrenamiento.

| Dimensión | Valores |
|---|---|
| `presenter` | dueño a cámara · presentador · solo manos/producto · sin persona · avatar |
| `production` | casero con celular · producido |
| `format` | testimonio · demostración · antes/después · unboxing · tutorial · humor · historia · POV |
| `tone` | directo/vendedor · emocional · educativo · divertido · aspiracional |
| `pace` | rápido (≤15 s, cortes rápidos) · medio · pausado (30 s+) |
| `audio` | habla a cámara · voz en off · música de tendencia · solo texto |
| `hook` | precio · problema · resultado · pregunta · curiosidad |
| `positioning` | masivo/barato · premium |

---

## 2. Arquitectura

```
                 ┌────────────────────── Fuentes del cliente ──────────────────────┐
                 │ Hecom (biz, notes, ig) · campañas · tienda RP · Creativos        │
                 └───────────────┬──────────────────────────────────────────────────┘
                                 ▼
                        radar_client_profiles  ◄── reacciones (radar_reactions)
                                 │
 TikTok Discovery API ──► job radar/discovery ──► radar_hashtags + radar_videos (+ etiquetas)
   (diario, por categoría y país)                         │
                                                          ▼
                                            selección de rondas (lib/radar/rounds.ts)
                                                          │
                                                          ▼
                                         UI Profit › Radar (reproductor oficial TikTok)
                                                          │
                                                          ▼
                                    receta única (lib/radar/recipe.server.ts) ─► radar_recipes
                                                          ▲
 TikTok Reporting AUCTION_AD ──► job radar/ad-daily ──► radar_ad_daily ──┘ (ganadores agregados
   (diario, cuentas con gasto)            │                               por rubro, ≥5 cuentas)
                                          └──► Profit lee de aquí (menos consultas en vivo)

 oEmbed (servidor) ──► job radar/liveness ──► marca videos muertos
```

- **Base de datos:** proyecto principal de Supabase (`createAdminClient()`), donde ya viven las
  tablas `rp_*`. Hecom vive en otro proyecto, así que todo se liga por `hecom_cliente_id` (texto).
- **Acceso:** solo por rutas de API del servidor con `service_role`, igual que Profit (cliente
  seleccionado por cookie + `requirePermission("adAccounts:read")`). RLS activado, sin políticas
  para `authenticated`.

---

## 3. Modelo de datos

Migración: [`supabase/migrations/061_profit_radar.sql`](../supabase/migrations/061_profit_radar.sql)
(escrita en la Fase 1; es la fuente de verdad). Cambio respecto del borrador de abajo: un video
puede salir en varios hashtags, categorías y países, así que esa relación vive en
**`radar_video_sources`** (`video_id`, `category_name`, `country_code`, `hashtag_id`,
`discovery_rank`, `last_seen_date`) y `radar_videos` guarda solo el video. También se agregaron
`author_name` y `dead_reason` en `radar_videos`, y `results` y `cost_per_conversion` en
`radar_ad_daily`. Borrador original:

```sql
-- Perfil del cliente para el Radar (1 fila por cliente Hecom)
create table if not exists public.radar_client_profiles (
  hecom_cliente_id text primary key,
  category_name text,                 -- categoría Discovery (HEALTH, APPAREL_AND_ACCESSORIES…)
  subcategory_name text,
  products jsonb not null default '[]',      -- [{name, price?, source}]
  objective text,                     -- messages | sales | followers
  can_appear jsonb not null default '{}',    -- quién puede salir en cámara
  taste jsonb not null default '{}',         -- pesos por etiqueta {presenter:{owner:1.4,…},…}
  seed jsonb not null default '{}',          -- perfil sugerido por la IA + fuentes usadas
  onboarding_step text not null default 'pending', -- pending|categories|round1|round2|done|skipped
  consent_radar boolean not null default false,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hashtags en tendencia por categoría y país (foto diaria)
create table if not exists public.radar_hashtags (
  hashtag_id text not null,
  country_code text not null,
  category_name text not null,
  date_range text not null,
  snapshot_date date not null,
  hashtag_name text not null,
  rank_position int,
  rank_change text,
  views bigint,
  posts bigint,
  top_countries text[] not null default '{}',
  primary key (hashtag_id, country_code, category_name, date_range, snapshot_date)
);

-- Biblioteca de videos (solo enlaces y etiquetas; nunca el archivo)
create table if not exists public.radar_videos (
  video_id text primary key,          -- id de TikTok
  share_url text not null,
  embed_url text,
  author_handle text,
  caption text,
  country_code text not null,
  category_name text not null,
  hashtags text[] not null default '{}',
  discovery_rank int,                 -- posición en el top del hashtag (1–20)
  tags jsonb not null default '{}',   -- etiquetas de la sección 1
  tags_source text,                   -- text | manual | vision
  tags_version text,
  status text not null default 'alive',  -- alive | dead
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_checked_at timestamptz
);
create index if not exists radar_videos_pool_idx
  on public.radar_videos (category_name, country_code, status, last_seen_at desc);

-- Reacciones del cliente en las rondas
create table if not exists public.radar_reactions (
  hecom_cliente_id text not null,
  video_id text not null references public.radar_videos(video_id),
  round smallint not null,            -- 1 | 2
  reaction text not null,             -- like | dislike | pick
  created_at timestamptz not null default now(),
  primary key (hecom_cliente_id, video_id, round)
);

-- Recetas generadas
create table if not exists public.radar_recipes (
  id uuid primary key default gen_random_uuid(),
  hecom_cliente_id text not null,
  product text,
  input_video_ids text[] not null default '{}',
  profile_snapshot jsonb not null default '{}',
  recipe jsonb not null,              -- gancho, estructura, formato, duración, texto, CTA, porqué
  scripts jsonb not null default '[]',-- 3 ideas
  originality jsonb not null default '{}', -- resultado del filtro anti-copia
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);
create index if not exists radar_recipes_cliente_idx
  on public.radar_recipes (hecom_cliente_id, created_at desc);

-- Métricas diarias por anuncio (base del Radar agregado, de Profit y del futuro Piloto)
create table if not exists public.radar_ad_daily (
  advertiser_id text not null,
  ad_id text not null,
  stat_date date not null,
  hecom_cliente_id text,
  campaign_id text, campaign_name text,
  adgroup_id text, ad_name text,
  video_id text, tiktok_item_id text,
  spend numeric(14,2) not null default 0,
  impressions bigint, clicks bigint, ctr numeric(8,4),
  conversions numeric(14,2), cost_per_result numeric(14,4),
  video_play_actions bigint, video_watched_2s bigint, video_watched_6s bigint,
  average_video_play numeric(10,3),
  fetched_at timestamptz not null default now(),
  primary key (advertiser_id, ad_id, stat_date)
);

-- Corridas de los procesos (reanudables e idempotentes)
create table if not exists public.radar_job_runs (
  job text not null,
  run_date date not null,
  status text not null default 'running',   -- running | partial | complete | failed
  cursor jsonb not null default '{}',
  stats jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (job, run_date)
);

alter table public.radar_client_profiles enable row level security;
alter table public.radar_hashtags enable row level security;
alter table public.radar_videos enable row level security;
alter table public.radar_reactions enable row level security;
alter table public.radar_recipes enable row level security;
alter table public.radar_ad_daily enable row level security;
alter table public.radar_job_runs enable row level security;
-- Sin políticas para authenticated: acceso solo por rutas del servidor con service_role.
```

Notas:
- `ad_account_daily_metrics` y `campaign_daily_metrics` (migración 003) existen pero nadie las
  usa y van por `ad_account_id` interno. `radar_ad_daily` va por `advertiser_id` de TikTok, que es
  la llave que usa todo el código de TikTok.
- Hay números de migración repetidos (013 y 052): usar **061** y verificar antes de crear.

---

## 4. Integración con TikTok

### 4.1 Cliente HTTP compartido (nuevo)
`lib/integrations/tiktok/http.server.ts`. Hoy cada archivo copia su propio `apiUrl` y
`tiktokGet`; **solo el código nuevo** usa este helper (no se refactoriza lo existente en esta
etapa).

- `tiktokRequest<T>({ method, path, query?, body?, token })` con `Access-Token`, `cache:"no-store"`,
  timeout de 20 s y arrays serializados con `JSON.stringify`.
- **Freno compartido por proceso:** cola token-bucket configurable (`RADAR_TIKTOK_QPS`, por
  defecto 5) para dejar espacio a los demás procesos que usan el mismo token.
- **Reintentos:** ante `40100` / `40016` / `40133` o mensaje `OVER_QPS|RATE|LIMIT`, espera 5 min.
  Si no cabe en el tiempo del proceso, guarda el cursor en `radar_job_runs` y termina como
  `partial`. Nunca reintenta en bucle.
- Token: `resolveTikTokFinanceAccessToken()` (`lib/integrations/tiktok/bc-finance.server.ts`).

### 4.2 Discovery API
`lib/integrations/tiktok/discovery.server.ts` (parámetros confirmados en la documentación):

| Endpoint | Parámetros | Devuelve |
|---|---|---|
| `GET /discovery/trending_list/` | `advertiser_id`*, `discovery_type=HASHTAG`*, `country_code` (def. US), `category_name` (nivel 1 o 2, def. ALL), `date_range` (`1DAY`/`7DAY`/`30DAY`/`120DAY`, def. 7DAY) | Top 200 hashtags: `hashtag_id`, `hashtag_name`, `rank_position`, `rank_change`, `views`, `posts`, `top_country_list` |
| `GET /discovery/video_list/` | `advertiser_id`*, `discovery_type=HASHTAG`*, `hashtag_ids`* (máx. 10), `country_code` (debe estar en el `top_country_list` del hashtag), `date_range` | 20 videos top por hashtag: `video_id`, `embed_url`, `share_url` (ordenados por vistas, likes, comentarios y compartidos) |

- Permiso de la app: **Creative Management › Discovery**. TikTok revisa en 2–3 días hábiles.
- Sin métricas por video: el orden lo da TikTok.
- `advertiser_id`: cualquiera de las cuentas que cubre el token (configurable en
  `RADAR_DISCOVERY_ADVERTISER_ID`).

### 4.3 Reporte diario por anuncio
`lib/integrations/tiktok/ad-daily-report.server.ts`, adaptado de
`campaign-performance.server.ts`:

- `GET /report/integrated/get/` con `report_type=BASIC`, `service_type=AUCTION`,
  `data_level=AUCTION_AD`, `dimensions=["ad_id","stat_time_day"]`, un solo día (ayer en Lima),
  `page_size=1000` con paginación, hasta 5 cuentas por llamada en `advertiser_ids` (probar; si
  falla, una por llamada).
- Métricas: `spend, impressions, clicks, ctr, conversion, cost_per_conversion, result,
  cost_per_result, video_play_actions, video_watched_2s, video_watched_6s, average_video_play,
  ad_name, campaign_id, campaign_name, adgroup_id`.
- Video de cada anuncio: `/ad/get/` (`video_id`, `tiktok_item_id` en Spark Ads), reutilizando
  `lib/integrations/tiktok/ad-list.server.ts`.
- Filtro previo: solo cuentas con gasto ayer (ya conocido por `tiktok/sync`, o reporte
  `report_type=BC` por BM).
- Advertiser → cliente: misma lógica canónica que `app/api/jobs/tiktok/sync/route.ts`.

### 4.4 oEmbed (servidor)
`lib/radar/oembed.server.ts`: `GET https://www.tiktok.com/oembed?url=<share_url>` → vivo/muerto,
`title` (texto del video), `author_name`, `thumbnail_url`. Se llama desde el servidor, así que no
lo bloquea la CSP. Las miniaturas caducan: no se guardan, se piden al armar la ronda (con caché
corta).

---

## 5. Procesos diarios (`vercel.json`, horario en UTC; Lima = UTC−5)

| Ruta | Horario | Qué hace |
|---|---|---|
| `/api/jobs/radar/ad-daily` | `0 8,9 * * *` (03:00 y 04:00 Lima) | Métricas por anuncio de los **últimos 3 días** (una consulta por cuenta; TikTok ajusta conversiones días después) → `radar_ad_daily`. La segunda pasada retoma si la primera quedó a medias; si ya terminó, no hace nada. |
| `/api/jobs/radar/discovery` | `30 8,9 * * *` (03:30 y 04:30 Lima) | Por cada categoría activa (`RADAR_DEFAULT_CATEGORIES` + las de los perfiles) × país: `trending_list` → elegir hashtags → `video_list` → upsert en `radar_videos` y `radar_video_sources`. Los videos nuevos se etiquetan en `/api/jobs/radar/tag` (`45 8,9,10 * * *`). |
| `/api/jobs/radar/liveness` | `0 6 * * *` (01:00 Lima) | oEmbed de los videos mostrados en los últimos 14 días y de los candidatos de mañana → marca `dead`. |

Convenciones del repo: `GET` y `POST` con la misma lógica, `isAuthorized` con `CRON_SECRET` /
`INTERNAL_JOB_SECRET`, `runtime="nodejs"`, `maxDuration=300`, presupuesto de 230 s, respuesta
`{ ok, ...conteos, errors }`, logs `console.info("[radar] evento", {...})`.

**Países:** `RADAR_COUNTRY_CODES` (por defecto `PE,MX,CO`). Si la prueba muestra que Perú no
tiene datos, se usan MX y CO como respaldo (mismo idioma y estilo parecido) y se avisa en la UI
("tendencias de la región").

**Consumo estimado:** ~6 categorías × 3 países × (1 + 1–2) llamadas de Discovery + ~10–20
llamadas de reporte + ~50–100 de `/ad/get/` = **menos de 250 llamadas al día**, frente a un cupo
de 864.000 por endpoint.

---

## 6. Inteligencia artificial

Todo con `serverEnv.openAiApiKey` y `serverEnv.openAiVisionModel` (como `profit-advisor.server.ts`),
respuestas en JSON con esquema validado y `prompt_version` guardado.

| Pieza | Archivo | Entrada → salida |
|---|---|---|
| Perfil inicial | `lib/radar/profile-seed.server.ts` | fuentes de la sección 1 → categoría, productos, objetivo, estilo actual |
| Etiquetado v1 (texto) | `lib/radar/tag-video.server.ts` | `caption`, hashtags y autor (oEmbed) → etiquetas + confianza |
| Etiquetado v2 (visual) | — | **En pausa** hasta confirmar con TikTok que se puede analizar la imagen de videos públicos |
| Selección de rondas | `lib/radar/rounds.ts` (puro, con tests) | ronda 1: máxima variedad de etiquetas + mejor `discovery_rank`; ronda 2: puntaje por perfil; excluye vistos, muertos y rechazados; deja reemplazos de reserva |
| Perfil de gusto | `lib/radar/taste.ts` (puro, con tests) | reacciones → pesos por etiqueta |
| Receta única | `lib/radar/recipe.server.ts` | videos elegidos (etiquetas + texto), perfil, producto, ganadores agregados del rubro (≥5 cuentas, de `radar_ad_daily`), restricciones de política del rubro → receta + 3 guiones + porqué |
| Filtro anti-copia | `lib/radar/originality.ts` | compara guiones contra los textos de origen (n-gramas + revisión de la IA); si se parece demasiado, regenera |

**Políticas del rubro:** varios clientes venden suplementos (salud). La receta no puede prometer
curas ni resultados médicos; reutilizar los `policy_risks` del análisis de Creativos
(`lib/creatives/analyze-creative.server.ts`).

---

## 7. Rutas de API (`app/api/profit/radar/*`)

Mismo patrón que `app/api/profit/route.ts`: `runtime="nodejs"`, `requirePermission("adAccounts:read")`,
`getSelectedHecomCliente`, errores `{ error: "<mensaje en español>" }`.

| Ruta | Para qué |
|---|---|
| `GET /api/profit/radar` | Estado: perfil, paso del arranque, última receta. Si no hay perfil, genera la semilla. |
| `POST /api/profit/radar/profile` | Confirma categorías, productos, objetivo, quién sale en cámara, consentimiento. |
| `GET /api/profit/radar/round?n=1\|2` | Videos de la ronda (con miniatura y autor vía oEmbed) + reservas. |
| `POST /api/profit/radar/reactions` | Guarda reacciones y recalcula el perfil de gusto. |
| `POST /api/profit/radar/video-dead` | El reproductor avisó que un video no carga → marcar `dead` y devolver un reemplazo. |
| `POST /api/profit/radar/recipe` | Genera la receta única (`maxDuration=60`). |
| `GET /api/profit/radar/recipes` | Historial de recetas del cliente. |

---

## 8. Interfaz en Profit

### Dónde va
- **Subruta `app/(dashboard)/profit/radar/page.tsx`** con el mismo preámbulo de
  `app/(dashboard)/profit/page.tsx` (permiso, cliente seleccionado, `PickClienteEmpty`). Queda
  protegida por el prefijo `/profit` de `config/auth.ts` y el ítem "Profit" del menú sigue activo.
- **Selector "Análisis · Radar"** en el encabezado de `ProfitPageClient.client.tsx` (L1082-1098)
  y en el del Radar. Así no crece el archivo de 2.413 líneas.
- **Primera visita:** si `onboarding_step` no es `done` ni `skipped`, Profit muestra una tarjeta
  "Descubre qué videos te convienen" que lleva al arranque del Radar.
- Componentes en `features/profit/radar/components/`.

### Pantallas
1. **Categorías:** prellenadas, chips seleccionables, pregunta de quién sale en cámara, objetivo,
   consentimiento.
2. **Ronda 1 y ronda 2:** grilla de miniaturas (oEmbed); al tocar, se carga el reproductor; "me
   gusta" / "no me gusta"; contador de progreso.
3. **Receta:** ingredientes de la receta, 3 guiones, "por qué" de cada parte, botón para llevarla
   al flujo de Creativos.
4. **Mis recetas y preferencias:** historial y "rehacer mi perfil".

### Reproductor (`TikTokEmbed.client.tsx`)
- `iframe` a `https://www.tiktok.com/player/v1/{video_id}?controls=1&progress_bar=1&music_info=0&description=0&rel=0&autoplay=0&muted=1`.
- Escucha `postMessage` (`onPlayerReady`, `onStateChange`, `onPlayerError`). En `onPlayerError`
  (por ejemplo, 1001 `INVALID_VIDEO`) llama a `/video-dead` y cambia el video por el de reserva
  sin mostrar error.
- Un solo video sonando a la vez (pausa los demás con `postMessage` `pause`).
- Carga perezosa: miniatura primero, `iframe` solo al tocar.
- No tapar la marca de TikTok; el "como si estuviera en nuestro sistema" lo da el diseño de la
  tarjeta.
- Botón **"Ver en TikTok"** al `share_url` (abre en una pestaña nueva).

### Cambios necesarios
- **CSP:** agregar `https://www.tiktok.com` a `frame-src` en `next.config.ts` (hoy solo permite
  Loom, Google y Clerk). `img-src` ya permite `*.tiktokcdn.com`.
- Miniaturas con `<img>` (no `next/image`, que no tiene `remotePatterns` configurado).
- **i18n:** bloque `profit.radar.*` en `messages/es.json`, `en.json` y `pt-BR.json`.
- **Bandera:** `PROFIT_RADAR_ENABLED` (`parseBoolean` en `lib/env/env.server.ts`) y lanzamiento
  primero para staff (`resolvePaymentsFundingCapabilities`) antes de abrirlo a clientes.

### Diseño
- Sistema Holistic (`docs/SISTEMA_DISENO_HOLISTIC.md`): fondo cálido, Sora para títulos y Plus
  Jakarta Sans para la interfaz.
- Decisiones vigentes de `Cerebro/20 Marca y Diseño`: **el naranja es acento** (máximo tres
  lugares por pantalla) y **el botón principal va en carbón `#17150f`** con texto blanco. Profit
  hoy tiene naranja repartido y botones naranjas con texto blanco: corregirlo en la mejora de
  diseño.
- Skills: `impeccable` (crítica y pulido), `emil-design-eng` y `review-animations` (movimiento de
  rondas y transiciones), `taste-skill` y `redesign-skill` (rediseño de Profit), `ui-ux-pro-max`
  (sistema y accesibilidad).
- Funciona en celular y en la app de iOS (Capacitor). Respeta `prefers-reduced-motion`.

---

## 9. Fases

### Fase 0 · Preparación (esta rama)
- [x] Plan técnico (este documento)
- [x] Script de prueba `scripts/probe-tiktok-discovery.mjs`
- [x] Rama `feat/profit-radar` y `.claude/launch.json` para levantar el proyecto
- [ ] Copiar `.env.local` a esta PC
- [ ] Activar el permiso Discovery en la app de TikTok de Holistic
- [ ] Correr la prueba con Perú: `node --use-system-ca --env-file=.env.local scripts/probe-tiktok-discovery.mjs --advertiser=<id>`
- [ ] Decisiones del equipo (sección 11)

### Fase 1 · Cimientos de datos
- [x] Migración `061_profit_radar.sql`
- [x] `http.server.ts` con freno y reintentos (`rate-limit.ts` + tests)
- [x] `discovery.server.ts`, `discovery-sync.server.ts` y `/api/jobs/radar/discovery`
- [x] `ad-daily-report.server.ts`, `ad-daily-sync.server.ts` y `/api/jobs/radar/ad-daily`
- [x] `oembed.server.ts`, `liveness.server.ts` y `/api/jobs/radar/liveness`
- [x] Crons en `vercel.json` y variables en `lib/env/env.server.ts`
- [x] Tests de las piezas puras: `node --test lib/integrations/tiktok/rate-limit.test.ts lib/radar/*.test.ts` (18)
- [ ] Aplicar la migración en Supabase
- [ ] Probar a mano con el secreto del cron (`?force=1`) y luego encender `RADAR_JOBS_ENABLED`

**Probar a mano** (con `CRON_SECRET`; `?force=1` corre aunque la bandera esté apagada, `&redo=1`
rehace un día ya completo):
- `GET /api/jobs/radar/ad-daily?force=1&advertiser_ids=<id>` · una sola cuenta, no marca el día
- `GET /api/jobs/radar/ad-daily?force=1&date=2026-10-10`
- `GET /api/jobs/radar/discovery?force=1` · si falta el permiso, responde 502 y lo dice
- `GET /api/jobs/radar/liveness?force=1&limit=50`

**Hecho cuando:** la biblioteca se llena sola cada día con videos vivos por categoría y país, y
`radar_ad_daily` tiene las métricas de ayer de todas las cuentas con gasto.

### Fase 2 · Perfil y rondas
- [x] `profile-seed.server.ts`, `tag-video.server.ts`, `rounds.ts`, `taste.ts` (+ tests de los puros)
- [x] Rutas `GET /radar`, `POST /profile`, `GET /round`, `POST /reactions`, `POST /video-dead`
- [x] Subruta `/profit/radar` y selector Análisis · Radar en el encabezado de Profit
- [x] Estructura elegida: **conversación guiada** (Impeccable, contrato en `.impeccable/surfaces/`). Línea "Tu perfil" fija, rubro → productos → quién sale en cámara → objetivo → consentimiento → ronda amplia (12, de a 3) → lo aprendido → ronda reducida (8, elegir) → listo
- [x] `TikTokEmbed.client.tsx` (reproductor oficial, uno a la vez, reemplazo silencioso), CSP `frame-src` con tiktok.com, textos `profit.radar.*` en es/en/pt-BR, bandera y solo staff
- [ ] Revisión visual en el navegador (requiere `.env.local`), revisión final de Impeccable y DESIGN.md
- [x] Tarjeta de primera visita en Profit (mientras el cliente no arme su perfil)

**Hecho cuando:** un usuario de staff completa las dos rondas y su perfil de gusto queda guardado.

### Fase 3 · Receta única
- [x] `recipe.server.ts`: referencias (elegidos primero), perfil, gusto, reglas de publicidad del rubro y referencia de costos del rubro (`benchmarks.ts`: por cuenta, mínimo 5 clientes distintos, percentiles)
- [x] `originality.ts`: trigramas y racha de palabras contra los textos de referencia; regenera una vez y descarta lo copiado; resultado guardado en `radar_recipes.originality`
- [x] `GET|POST /api/profit/radar/recipe` y la última receta en `GET /api/profit/radar`
- [x] Pantalla de receta: ingredientes, estructura, por qué funciona, qué evitar, 3 guiones (se ve / se dice) con copiar, enlace a Creativos
- [x] Tests: `lib/radar/recipe.test.ts` (34 en total en el Radar)

**Hecho cuando:** la receta sale en menos de 30 s, con 3 guiones que pasan el filtro anti-copia.

### Fase 4 · Profit más rápido, Radar agregado y diseño
- [x] Tabla "Rendimiento por anuncio" en Profit (`ProfitAdsTable.client.tsx`, `GET /api/profit/ads`): gasto, CTR, resultados, costo por resultado vs. el promedio del cliente, retención a 2 s y 6 s, días; ordenable; desde `radar_ad_daily`
- [x] Profit arma el rendimiento por campaña desde `radar_ad_daily` cuando las corridas completas de ad-daily cubren todo el rango (`stored-campaign-perf.server.ts`); si falta un día, consulta en vivo como antes. Solo con `RADAR_JOBS_ENABLED`. La ventana del puntaje (30 días hasta hoy) sigue en vivo porque incluye el día en curso
- [x] Referencias de costo por rubro (≥5 clientes) en la receta (Fase 3)
- [ ] Ganadores por rubro a partir de anuncios (necesita etiquetar los videos de los anuncios de clientes)
- [ ] Mejora de diseño de Profit (naranja como acento, botón carbón, jerarquía)
- [ ] Lanzamiento a clientes (quitar el filtro de staff)

### Fase 5 · Piloto
- [x] `lib/radar/pilot.ts` (puro, 7 tests): con los últimos 14 días por anuncio propone
  pausar el perdedor del mismo grupo que un ganador, pausar perdedores, escalar ganadores
  (recomendación, máx. 50%), renovar anuncios cansados (CTR −30% frente a sus primeros días)
  y "todo pierde" (cambiar de creativo). Nada en aprendizaje: 4 días con gasto y $15 mínimo;
  solo anuncios que gastaron en los últimos 2 días; máximo 4 propuestas
- [x] `GET|POST /api/profit/pilot`: el servidor recalcula y revalida todo; el navegador solo
  manda el id. Ver: `adAccounts:read`. Confirmar o descartar: `adAccounts:create`
- [x] Única acción ejecutable: **pausar** (`/ad/status/update/`, DISABLE, reversible), detrás
  de `PILOT_ACTIONS_ENABLED` (apagado por defecto) y comprobando que la cuenta es del cliente.
  Subir presupuesto nunca se ejecuta: el Copiloto no compromete saldo
- [x] Auditoría en `radar_pilot_actions` (migración 063): quién, qué, cuándo, respuesta de
  TikTok; lo hecho o descartado no se vuelve a proponer por 7 días
- [x] Panel "Piloto" en Profit con confirmación en dos pasos y "Ahora no"
- [ ] Probar la pausa con una cuenta de prueba antes de encender `PILOT_ACTIONS_ENABLED`

---

## 9.5 Cómo encenderlo, paso a paso

Todo llega a `main` apagado. Encender en este orden y verificar cada paso antes del siguiente.

| # | Paso | Quién | Cómo se verifica |
|---|---|---|---|
| 1 | Aplicar las migraciones `061_profit_radar.sql` y `063_radar_pilot_actions.sql` en Supabase (proyecto principal, editor SQL) | Quien administre Supabase | Las tablas `radar_*` existen |
| 2 | Activar el permiso **Creative Management › Discovery** en la app de TikTok for Business (revisión de 2–3 días hábiles) | Admin de la app de TikTok | `node --use-system-ca --env-file=.env.local scripts/probe-tiktok-discovery.mjs --advertiser=<id>` dice si hay videos para PE |
| 3 | Probar a mano los procesos con el secreto del cron: `ad-daily`, `discovery`, `tag` y `liveness` con `?force=1` (ver Fase 1) | Desarrollo | Filas en `radar_ad_daily`, `radar_videos`, `radar_video_sources`; `radar_job_runs` en `complete` |
| 4 | `RADAR_JOBS_ENABLED=true` en Vercel | Desarrollo | Al día siguiente, `radar_job_runs` tiene corridas de madrugada |
| 5 | `PROFIT_RADAR_ENABLED=true` con `PROFIT_RADAR_STAFF_ONLY=true` | Desarrollo | Solo el staff ve el selector Análisis · Radar, la tabla por anuncio y el Piloto |
| 6 | Revisión visual e Impeccable (capturas en escritorio y celular, revisión final, `DESIGN.md`) | Desarrollo | Veredicto de la revisión final |
| 7 | Probar la pausa en una cuenta de **prueba**: `node --use-system-ca --env-file=.env.local scripts/probe-pilot-pause.mjs --advertiser=<id> --ad=<ad_id>` (solo mira), luego `--confirm` y `--confirm --enable` | Desarrollo con el staff | El anuncio pasa a `DISABLE` y vuelve a `ENABLE` |
| 8 | `PILOT_ACTIONS_ENABLED=true` | Atter | Una pausa confirmada queda en `radar_pilot_actions` con `status=done` |
| 9 | `PROFIT_RADAR_STAFF_ONLY=false`: abrir a los clientes | Equipo | Clientes ven la invitación al Radar en Profit |

## 10. Variables de entorno nuevas

| Variable | Por defecto | Uso |
|---|---|---|
| `PROFIT_RADAR_ENABLED` | `false` | Enciende el Radar en Profit |
| `PROFIT_RADAR_STAFF_ONLY` | `true` | Solo staff mientras se prueba |
| `RADAR_JOBS_ENABLED` | `false` | Enciende los 3 procesos diarios |
| `RADAR_COUNTRY_CODES` | `PE,MX,CO` | Países de Discovery, en orden de preferencia |
| `RADAR_DEFAULT_CATEGORIES` | `HEALTH,BEAUTY_AND_PERSONAL_CARE,APPAREL_AND_ACCESSORIES,HOME_IMPROVEMENT,HOUSEHOLD_PRODUCTS` | Categorías que se buscan aunque ningún cliente tenga perfil |
| `RADAR_DISCOVERY_ADVERTISER_ID` | primera cuenta de cliente | Cuenta que se pasa como `advertiser_id` a Discovery |
| `RADAR_DISCOVERY_DATE_RANGE` | `30DAY` | Ventana de tendencia |
| `RADAR_HASHTAGS_PER_CATEGORY` | `10` | Hashtags por categoría y país en `video_list` (máx. 10) |
| `RADAR_TIKTOK_QPS` | `5` | Freno de los procesos del Radar (máx. 9) |
| `PILOT_ACTIONS_ENABLED` | `false` | Permite que el cliente confirme "pausar anuncio" y se ejecute en TikTok |
| `SERPER_API_KEY` | vacío (apagado) | Búsqueda web (Google vía serper.dev): segunda fuente de videos mientras Discovery no esté aprobado, y después junto a él |
| `RADAR_WEB_QUERIES_PER_RUN` | `60` | Tope de búsquedas web por noche (1 crédito de Serper cada una) |

**Búsqueda web (segunda fuente).** `lib/radar/web-discovery.server.ts` busca `site:tiktok.com/@ <producto>`
con los productos del perfil y luego el rubro, acepta solo enlaces reales de video de tiktok.com,
los comprueba con oEmbed y los guarda en `radar_videos` / `radar_video_sources` con
`hashtag_id = web:<consulta>`. Corre cada noche (`/api/jobs/radar/web`, antes de `/tag`) y en el
momento en que una ronda no tiene suficientes videos (`/api/profit/radar/round`, hasta 6 búsquedas).
No se usa la búsqueda web de OpenAI: probada el 12/10, inventa los enlaces de video.

---

## 11. Decisiones y preguntas abiertas

**Equipo**
1. ¿El cliente que no da consentimiento puede ver recetas?
2. ¿Quién del equipo revisa las primeras recetas antes de abrirlo a clientes?
3. Lista final de categorías (4–6 rubros amplios) y su correspondencia con las de Discovery.

**Representante de TikTok**
1. ¿Discovery devuelve datos con `country_code=PE`? ¿Qué países soporta?
2. ¿Se pueden mostrar sus resultados dentro de una plataforma para terceros (nuestros clientes)?
3. ¿Se puede analizar con IA la imagen de los videos que devuelve Discovery?
4. ¿Hay acuerdo posible para usar datos entre clientes cuando las cuentas son de la agencia?

---

## 12. Mapa de archivos

| Nuevo | Se toca |
|---|---|
| `supabase/migrations/061_profit_radar.sql` | `next.config.ts` (CSP `frame-src`) |
| `lib/integrations/tiktok/http.server.ts` | `vercel.json` (3 crons) |
| `lib/integrations/tiktok/discovery.server.ts` | `lib/env/env.server.ts` (variables) |
| `lib/integrations/tiktok/ad-daily-report.server.ts` | `features/profit/components/ProfitPageClient.client.tsx` (selector y tarjeta) |
| `lib/radar/*` (oembed, profile-seed, tag-video, rounds, taste, recipe, originality) | `messages/{es,en,pt-BR}.json` |
| `app/api/jobs/radar/{ad-daily,discovery,liveness}/route.ts` | `lib/realprofit/profit-snapshot.server.ts` (fase 4) |
| `app/api/profit/radar/**/route.ts` | |
| `app/(dashboard)/profit/radar/page.tsx` | |
| `features/profit/radar/components/*` | |

**Convenciones:** Next 16 (`params` y `searchParams` son promesas; leer
`node_modules/next/dist/docs/` antes de escribir), sin `cacheComponents`, tests con
`node --test archivo.test.ts`, validar con `npm run validate`.
