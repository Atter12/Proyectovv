-- Educación separada por público: las categorías equipo-* son solo para gerentes.
-- El público sale de la categoría; los tutoriales de clientes no cambian.

alter table public.education_lessons
  drop constraint if exists education_lessons_category;

alter table public.education_lessons
  add constraint education_lessons_category check (
    category_id is null
    or category_id in (
      'empieza', 'plataforma', 'tiktok', 'shopify', 'ayuda',
      'equipo-inicio', 'equipo-clientes', 'equipo-cobranza', 'equipo-cuentas', 'equipo-soporte'
    )
  );

-- Un cliente con sesión no puede leer los tutoriales del equipo ni consultando la tabla directo.
drop policy if exists education_lessons_select_authenticated on public.education_lessons;
create policy education_lessons_select_authenticated
  on public.education_lessons
  for select
  to authenticated
  using (category_id is null or category_id not like 'equipo-%');
