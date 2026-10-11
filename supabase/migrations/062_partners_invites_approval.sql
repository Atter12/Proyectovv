-- Control de alianzas: un código o link compartido no basta para quedar como
-- cliente del aliado (ni para su fee preferencial).
--  1) Códigos de invitación de un solo uso que el aliado crea por persona.
--  2) Quien se registra por link o código queda «pendiente» hasta que el aliado
--     confirma que es suyo; recién ahí cuenta y se le pone el fee del aliado.

alter table public.partner_clients
  add column if not exists status text not null default 'approved',
  add column if not exists invite_code text,
  add column if not exists reviewed_at timestamptz;

alter table public.partner_clients drop constraint if exists partner_clients_status_chk;
alter table public.partner_clients
  add constraint partner_clients_status_chk check (status in ('pending', 'approved'));

create table if not exists public.partner_invite_codes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  code text not null unique,
  -- Para quién lo creó el aliado (solo referencia suya).
  note text,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_email text,
  used_hecom_cliente_id text,
  revoked_at timestamptz,
  constraint partner_invite_codes_code_chk check (code ~ '^[A-Z0-9-]{4,24}$'),
  constraint partner_invite_codes_note_chk check (note is null or char_length(note) <= 80)
);
create index if not exists partner_invite_codes_partner_idx
  on public.partner_invite_codes (partner_id, created_at desc);

alter table public.partner_invite_codes enable row level security;
revoke all on public.partner_invite_codes from anon, authenticated;
