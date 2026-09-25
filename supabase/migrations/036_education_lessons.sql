-- Enlaces Loom de Educación. El temario (títulos y categorías) vive en código.

create table if not exists public.education_lessons (
  slug text primary key,
  loom_url text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint education_lessons_loom_url_len check (
    loom_url is null or char_length(loom_url) <= 500
  )
);

alter table public.education_lessons enable row level security;

drop policy if exists education_lessons_select_authenticated on public.education_lessons;
create policy education_lessons_select_authenticated
  on public.education_lessons
  for select
  to authenticated
  using (true);
