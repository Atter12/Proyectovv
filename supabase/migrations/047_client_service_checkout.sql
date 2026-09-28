-- El cliente nuevo paga la membresía en NAS después de enviar el contrato.
-- requires_checkout queda en false para filas viejas.

alter table public.client_service_contracts
  add column if not exists requires_checkout boolean not null default false,
  add column if not exists checkout_token text,
  add column if not exists checkout_started_at timestamptz,
  add column if not exists checkout_returned_at timestamptz;

alter table public.client_service_contracts
  drop constraint if exists client_service_contracts_checkout_token_len;
alter table public.client_service_contracts
  add constraint client_service_contracts_checkout_token_len
  check (checkout_token is null or char_length(checkout_token) = 36);
