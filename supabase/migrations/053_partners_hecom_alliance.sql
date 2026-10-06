-- Alianzas: el acuerdo se registra primero en Hecom (tabla alliances) y desde su
-- ficha se crea el aliado en Ads Holistic. Esta columna une ambos lados: una
-- alianza de Hecom tiene como máximo un aliado aquí.
alter table public.partners
  add column if not exists hecom_alliance_id uuid;

create unique index if not exists partners_hecom_alliance_idx
  on public.partners (hecom_alliance_id)
  where hecom_alliance_id is not null;
