-- Fase 4: las alertas de vencimiento y de firma atrasada se guardan como
-- recordatorios de la alianza. source_key evita duplicarlas.
-- Escritura solo con service role.

alter table public.alliance_reminders
  add column if not exists source_key text;

create unique index if not exists idx_alliance_reminders_source_key
  on public.alliance_reminders (source_key)
  where source_key is not null;
