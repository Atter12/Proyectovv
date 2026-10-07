-- Alianzas para clientes: el cliente que firma su contrato de alianza en Hecom
-- pasa a ser aliado. Recién con contract_signed_at puesto ve la sección
-- Alianzas en Ads Holistic y edita su landing (logo, colores, textos).
alter table public.partners
  add column if not exists hecom_cliente_id text,
  add column if not exists contract_signed_at timestamptz,
  add column if not exists theme text not null default 'light';

alter table public.partners drop constraint if exists partners_theme_chk;
alter table public.partners
  add constraint partners_theme_chk check (theme in ('light', 'dark'));

-- Un cliente tiene como máximo un aliado.
create unique index if not exists partners_hecom_cliente_idx
  on public.partners (hecom_cliente_id)
  where hecom_cliente_id is not null;

-- Logo y foto que sube el aliado. Público: se muestran en su landing /a/<link>.
-- Solo el servidor (service role) escribe; la app valida tipo y tamaño.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partner-assets', 'partner-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
