-- Contrato de servicio que el cliente crea al terminar el OTP de registro.
-- El fee queda fijo en 10 y no hay precio de entrada.
-- Escritura solo con service role.

create table if not exists public.client_registration_intents (
  email text primary key,
  hecom_cliente_id text,
  legal_name text not null,
  doc_number text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  constraint client_registration_intents_email_len check (char_length(email) between 3 and 180),
  constraint client_registration_intents_name_len check (char_length(legal_name) between 2 and 160)
);

create table if not exists public.client_service_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  email text not null unique,
  hecom_cliente_id text,
  party_type text not null,
  legal_name text not null,
  doc_type text not null,
  doc_number text not null,
  address text not null,
  phone text not null,
  fee_percent integer not null default 10,
  status text not null default 'draft',
  external_ref text,
  sign_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_service_contracts_party check (party_type in ('natural', 'company')),
  constraint client_service_contracts_doc check (doc_type in ('dni', 'ruc')),
  constraint client_service_contracts_status check (status in ('draft', 'pending_signature', 'signed', 'rejected')),
  constraint client_service_contracts_fee check (fee_percent = 10),
  constraint client_service_contracts_name_len check (char_length(legal_name) between 2 and 160),
  constraint client_service_contracts_address_len check (char_length(address) between 8 and 240)
);

create index if not exists idx_client_service_contracts_status
  on public.client_service_contracts (status);

alter table public.client_registration_intents enable row level security;
alter table public.client_service_contracts enable row level security;

grant all on public.client_registration_intents to service_role;
grant all on public.client_service_contracts to service_role;
