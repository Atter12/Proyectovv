-- Video MP4 de un tutorial, además del enlace de Loom.

alter table public.education_lessons
  add column if not exists video_path text;

alter table public.education_lessons
  drop constraint if exists education_lessons_video_len;

alter table public.education_lessons
  add constraint education_lessons_video_len check (
    video_path is null or char_length(video_path) <= 300
  );

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('education-videos', 'education-videos', true, 157286400)
    on conflict (id) do update
      set public = true,
          file_size_limit = 157286400;
  end if;
exception
  when undefined_column then
    insert into storage.buckets (id, name, public)
    values ('education-videos', 'education-videos', true)
    on conflict (id) do nothing;
end $$;
