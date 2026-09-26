-- Título, categoría e imagen de portada de los tutoriales de Educación.
-- Los del temario fijo pueden sobreescribir título y portada.
-- is_custom marca los que el gerente crea desde el panel.

alter table public.education_lessons
  add column if not exists title text,
  add column if not exists category_id text,
  add column if not exists poster_path text,
  add column if not exists is_custom boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.education_lessons
  drop constraint if exists education_lessons_title_len;

alter table public.education_lessons
  add constraint education_lessons_title_len check (
    title is null or char_length(btrim(title)) between 1 and 120
  );

alter table public.education_lessons
  drop constraint if exists education_lessons_category;

alter table public.education_lessons
  add constraint education_lessons_category check (
    category_id is null
    or category_id in ('empieza', 'plataforma', 'tiktok', 'shopify', 'ayuda')
  );

alter table public.education_lessons
  drop constraint if exists education_lessons_poster_len;

alter table public.education_lessons
  add constraint education_lessons_poster_len check (
    poster_path is null or char_length(poster_path) <= 300
  );

alter table public.education_lessons
  drop constraint if exists education_lessons_custom_fields;

alter table public.education_lessons
  add constraint education_lessons_custom_fields check (
    is_custom = false or (title is not null and category_id is not null)
  );

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('education-posters', 'education-posters', true)
    on conflict (id) do nothing;
  end if;
end $$;
