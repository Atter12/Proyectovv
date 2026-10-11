-- Radar dentro de Profit (Copiloto de anuncios). Ver docs/PLAN_PROFIT_RADAR.md.
-- Todo se liga por hecom_cliente_id (los clientes viven en el proyecto Hecom).
-- Acceso solo desde el servidor con service_role: RLS activo y sin políticas
-- para authenticated.

-- Perfil del cliente para el Radar (1 fila por cliente Hecom).
CREATE TABLE IF NOT EXISTS public.radar_client_profiles (
  hecom_cliente_id text NOT NULL,
  category_name text,
  subcategory_name text,
  products jsonb NOT NULL DEFAULT '[]'::jsonb,
  objective text CHECK (objective IS NULL OR objective IN ('messages', 'sales', 'followers')),
  can_appear jsonb NOT NULL DEFAULT '{}'::jsonb,
  taste jsonb NOT NULL DEFAULT '{}'::jsonb,
  seed jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarding_step text NOT NULL DEFAULT 'pending'
    CHECK (onboarding_step IN ('pending', 'categories', 'round1', 'round2', 'done', 'skipped')),
  consent_radar boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_client_profiles_pkey PRIMARY KEY (hecom_cliente_id)
);

COMMENT ON COLUMN public.radar_client_profiles.category_name IS
  'Categoría de la Discovery API de TikTok (HEALTH, APPAREL_AND_ACCESSORIES, …).';
COMMENT ON COLUMN public.radar_client_profiles.taste IS
  'Pesos por etiqueta aprendidos de las rondas: {"presenter": {"owner": 1.4}, …}.';
COMMENT ON COLUMN public.radar_client_profiles.seed IS
  'Perfil sugerido por la IA antes de la ronda 1 y las fuentes que usó.';

-- Hashtags en tendencia por categoría y país (foto diaria de /discovery/trending_list/).
CREATE TABLE IF NOT EXISTS public.radar_hashtags (
  hashtag_id text NOT NULL,
  country_code text NOT NULL,
  category_name text NOT NULL,
  date_range text NOT NULL,
  snapshot_date date NOT NULL,
  hashtag_name text NOT NULL,
  rank_position integer,
  rank_change text,
  views bigint,
  posts bigint,
  top_countries text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_hashtags_pkey
    PRIMARY KEY (hashtag_id, country_code, category_name, date_range, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_radar_hashtags_latest
  ON public.radar_hashtags (category_name, country_code, snapshot_date DESC, rank_position);

-- Biblioteca de videos: solo enlaces y etiquetas, nunca el archivo.
CREATE TABLE IF NOT EXISTS public.radar_videos (
  video_id text NOT NULL,
  share_url text NOT NULL,
  embed_url text,
  author_handle text,
  author_name text,
  caption text,
  tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags_source text CHECK (tags_source IS NULL OR tags_source IN ('text', 'manual', 'vision')),
  tags_version text,
  status text NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'dead')),
  dead_reason text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  CONSTRAINT radar_videos_pkey PRIMARY KEY (video_id)
);

CREATE INDEX IF NOT EXISTS idx_radar_videos_liveness
  ON public.radar_videos (status, last_checked_at NULLS FIRST);

-- De qué hashtag, categoría y país salió cada video (un video puede salir en varios).
CREATE TABLE IF NOT EXISTS public.radar_video_sources (
  video_id text NOT NULL REFERENCES public.radar_videos(video_id) ON DELETE CASCADE,
  category_name text NOT NULL,
  country_code text NOT NULL,
  hashtag_id text NOT NULL,
  hashtag_name text NOT NULL,
  discovery_rank integer,
  last_seen_date date NOT NULL,
  CONSTRAINT radar_video_sources_pkey
    PRIMARY KEY (video_id, category_name, country_code, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_radar_video_sources_pool
  ON public.radar_video_sources (category_name, country_code, last_seen_date DESC, discovery_rank);

-- Reacciones del cliente en las rondas.
CREATE TABLE IF NOT EXISTS public.radar_reactions (
  hecom_cliente_id text NOT NULL,
  video_id text NOT NULL REFERENCES public.radar_videos(video_id) ON DELETE CASCADE,
  round smallint NOT NULL CHECK (round IN (1, 2)),
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike', 'pick')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_reactions_pkey PRIMARY KEY (hecom_cliente_id, video_id, round)
);

-- Recetas generadas.
CREATE TABLE IF NOT EXISTS public.radar_recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hecom_cliente_id text NOT NULL,
  product text,
  input_video_ids text[] NOT NULL DEFAULT '{}',
  profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipe jsonb NOT NULL,
  scripts jsonb NOT NULL DEFAULT '[]'::jsonb,
  originality jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_recipes_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_radar_recipes_cliente
  ON public.radar_recipes (hecom_cliente_id, created_at DESC);

-- Métricas diarias por anuncio (base del Radar agregado, de Profit y del futuro Piloto).
CREATE TABLE IF NOT EXISTS public.radar_ad_daily (
  advertiser_id text NOT NULL,
  ad_id text NOT NULL,
  stat_date date NOT NULL,
  hecom_cliente_id text,
  campaign_id text,
  campaign_name text,
  adgroup_id text,
  ad_name text,
  video_id text,
  tiktok_item_id text,
  spend numeric(14, 2) NOT NULL DEFAULT 0,
  impressions bigint,
  clicks bigint,
  ctr numeric(10, 4),
  conversions numeric(14, 2),
  cost_per_conversion numeric(14, 4),
  results numeric(14, 2),
  cost_per_result numeric(14, 4),
  video_play_actions bigint,
  video_watched_2s bigint,
  video_watched_6s bigint,
  average_video_play numeric(10, 3),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_ad_daily_pkey PRIMARY KEY (advertiser_id, ad_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_radar_ad_daily_cliente_date
  ON public.radar_ad_daily (hecom_cliente_id, stat_date DESC);

CREATE INDEX IF NOT EXISTS idx_radar_ad_daily_date
  ON public.radar_ad_daily (stat_date DESC);

COMMENT ON COLUMN public.radar_ad_daily.ctr IS 'CTR en % tal como lo entrega TikTok (1.25 = 1.25%).';

-- Corridas de los procesos del Radar: reanudables e idempotentes.
CREATE TABLE IF NOT EXISTS public.radar_job_runs (
  job text NOT NULL,
  run_date date NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'partial', 'complete', 'failed')),
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_job_runs_pkey PRIMARY KEY (job, run_date)
);

ALTER TABLE public.radar_client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_video_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_ad_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_job_runs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.radar_client_profiles TO service_role;
GRANT ALL ON public.radar_hashtags TO service_role;
GRANT ALL ON public.radar_videos TO service_role;
GRANT ALL ON public.radar_video_sources TO service_role;
GRANT ALL ON public.radar_reactions TO service_role;
GRANT ALL ON public.radar_recipes TO service_role;
GRANT ALL ON public.radar_ad_daily TO service_role;
GRANT ALL ON public.radar_job_runs TO service_role;
