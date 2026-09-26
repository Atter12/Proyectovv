-- El gerente marca qué tutoriales salen en Videos recomendados.
-- null conserva la marca del temario fijo.

alter table public.education_lessons
  add column if not exists recommended boolean;
