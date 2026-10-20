-- Portada propia del video (se ve en el reproductor antes de darle play)
-- y el interruptor para ocultar un tutorial a los clientes sin borrarlo.

alter table public.education_lessons
  add column if not exists video_poster_path text;

alter table public.education_lessons
  drop constraint if exists education_lessons_video_poster_len;

alter table public.education_lessons
  add constraint education_lessons_video_poster_len check (
    video_poster_path is null or char_length(video_poster_path) <= 300
  );

alter table public.education_lessons
  add column if not exists active boolean not null default true;
