-- Dirección del cliente, obligatoria desde el registro (pedido de gerencia 13/10/2026):
-- hace falta para la carta notarial y el expediente de cobranza.
-- Hecom no tiene columna de dirección; aquí queda estructurada y en Hecom va en `notes`.
create table if not exists public.hecom_cliente_direcciones (
  hecom_cliente_id text primary key,
  email text not null,
  address text not null check (char_length(address) between 8 and 240),
  country text,
  source text not null default 'registro',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hecom_cliente_direcciones_email_idx on public.hecom_cliente_direcciones (email);

-- Solo el servidor (service role) lee y escribe.
alter table public.hecom_cliente_direcciones enable row level security;
