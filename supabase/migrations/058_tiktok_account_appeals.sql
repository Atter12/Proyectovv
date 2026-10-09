-- Apelaciones de cuentas TikTok suspendidas. TikTok no tiene API para apelar: el cliente
-- arma la apelación en Ads Holistic (datos + documentos + mensaje en inglés hecho con IA)
-- y gerencia la envía desde TikTok Business Support (Account Review).

create table if not exists public.tiktok_account_appeals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  hecom_cliente_id text not null,
  hecom_cliente_name text,
  ad_account_id uuid references public.ad_accounts(id) on delete set null,
  advertiser_id text not null,
  advertiser_name text,
  bm_label text,
  -- Lo que informa TikTok (advertiser/info.rejection_reason) al momento de apelar.
  suspension_reason text,
  suspension_until timestamptz,
  company_name text not null,
  tax_id text,
  store_url text,
  products text,
  contact_email text,
  contact_phone text,
  client_notes text,
  appeal_message text not null,
  attachments jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'approved', 'rejected')),
  staff_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Una apelación abierta por cuenta (pendiente o ya enviada a TikTok).
create unique index if not exists uq_tiktok_account_appeals_open
  on public.tiktok_account_appeals(advertiser_id)
  where status in ('pending', 'sent');

create index if not exists idx_tiktok_account_appeals_cliente
  on public.tiktok_account_appeals(hecom_cliente_id, created_at desc);

create index if not exists idx_tiktok_account_appeals_status
  on public.tiktok_account_appeals(status, created_at desc);

-- Solo el servidor (service role) lee y escribe.
alter table public.tiktok_account_appeals enable row level security;

-- Documentos del cliente (RUC, pedidos, facturas): privados, se ven con URL firmada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('appeal-docs', 'appeal-docs', false, 8388608,
        array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
