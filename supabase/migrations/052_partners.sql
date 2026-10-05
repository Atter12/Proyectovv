-- Alianzas: cada aliado tiene una landing propia (/a/<slug>), se mide cuántas
-- visitas y registros trae, y gana un % de lo que Holistic cobra a sus clientes.
-- Solo el servidor (service role) lee y escribe estas tablas.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  headline text,
  subheadline text,
  logo_url text,
  photo_url text,
  accent_color text not null default '#ff781f',
  whatsapp text,
  -- 0.20 = el aliado gana el 20% del fee que Holistic cobra a cada cliente.
  commission_rate numeric(5, 4) not null default 0.20,
  -- Meses desde el registro del cliente durante los que el aliado gana comisión.
  commission_months integer not null default 12,
  status text not null default 'active',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partners_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  constraint partners_status check (status in ('active', 'paused')),
  constraint partners_commission_rate check (commission_rate >= 0 and commission_rate <= 0.5),
  constraint partners_commission_months check (commission_months between 1 and 120)
);

-- Una fila por visita a la landing del aliado.
create table if not exists public.partner_visits (
  id bigserial primary key,
  partner_id uuid not null references public.partners (id) on delete cascade,
  visited_at timestamptz not null default now(),
  visitor_id text,
  path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  country text,
  device text
);
create index if not exists partner_visits_partner_time_idx
  on public.partner_visits (partner_id, visited_at desc);

-- Lo que trajo a cada registro: se guarda al crear el cliente (antes de que
-- exista el usuario) para no perder el código entre el registro y el OTP.
create table if not exists public.signup_attributions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  hecom_cliente_id text,
  partner_id uuid references public.partners (id) on delete set null,
  referral_code text,
  visitor_id text,
  created_at timestamptz not null default now()
);
create index if not exists signup_attributions_email_idx
  on public.signup_attributions (lower(email), created_at desc);

-- Qué clientes son de qué aliado. Un cliente pertenece a un solo aliado.
create table if not exists public.partner_clients (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  hecom_cliente_id text not null unique,
  email text,
  source text not null default 'landing',
  attributed_at timestamptz not null default now(),
  -- Hasta cuándo genera comisión (attributed_at + commission_months).
  expires_at timestamptz not null,
  created_by uuid,
  constraint partner_clients_source check (source in ('landing', 'manual'))
);
create index if not exists partner_clients_partner_idx on public.partner_clients (partner_id);

-- Una comisión por pago del cliente: rate × fee que Holistic cobró en ese pago.
create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  hecom_cliente_id text not null,
  payment_intent_id uuid not null unique,
  fee_cents bigint not null,
  rate numeric(5, 4) not null,
  commission_cents bigint not null,
  currency text not null default 'USD',
  earned_at timestamptz not null,
  status text not null default 'pending',
  paid_at timestamptz,
  payout_note text,
  created_at timestamptz not null default now(),
  constraint partner_commissions_status check (status in ('pending', 'paid', 'void'))
);
create index if not exists partner_commissions_partner_idx
  on public.partner_commissions (partner_id, earned_at desc);

alter table public.partners enable row level security;
alter table public.partner_visits enable row level security;
alter table public.signup_attributions enable row level security;
alter table public.partner_clients enable row level security;
alter table public.partner_commissions enable row level security;

revoke all on public.partners, public.partner_visits, public.signup_attributions,
  public.partner_clients, public.partner_commissions from anon, authenticated;
revoke all on sequence public.partner_visits_id_seq from anon, authenticated;
