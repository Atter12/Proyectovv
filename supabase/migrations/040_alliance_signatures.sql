-- Fase 3: el proveedor de firma vive fuera de la ficha.
-- FirmEasy devuelve un identificador y, al cerrar, el PDF firmado.
-- Escritura solo con service role. Sin políticas nuevas para clientes.

alter table public.alliance_contracts
  add column if not exists provider_status text,
  add column if not exists rejection_reason text,
  add column if not exists signature_storage_path text,
  add column if not exists signed_storage_path text,
  add column if not exists signed_file_name text;

alter table public.alliance_contracts
  drop constraint if exists alliance_contracts_provider_status_len;
alter table public.alliance_contracts
  add constraint alliance_contracts_provider_status_len
  check (provider_status is null or char_length(provider_status) <= 40);

alter table public.alliance_contracts
  drop constraint if exists alliance_contracts_rejection_len;
alter table public.alliance_contracts
  add constraint alliance_contracts_rejection_len
  check (rejection_reason is null or char_length(rejection_reason) <= 500);

alter table public.alliance_contract_signers
  add column if not exists phone text,
  add column if not exists external_ref text,
  add column if not exists sign_url text,
  add column if not exists provider_status text;

alter table public.alliance_contract_signers
  drop constraint if exists alliance_contract_signers_phone_len;
alter table public.alliance_contract_signers
  add constraint alliance_contract_signers_phone_len
  check (phone is null or char_length(phone) <= 40);

create unique index if not exists idx_alliance_contracts_external_ref
  on public.alliance_contracts (external_ref)
  where external_ref is not null;
