-- PDF firmado del contrato de registro y la fecha en que FirmEasy lo confirma.

alter table public.client_service_contracts
  add column if not exists signed_at timestamptz,
  add column if not exists signed_storage_path text;

alter table public.client_service_contracts
  drop constraint if exists client_service_contracts_signed_path_len;
alter table public.client_service_contracts
  add constraint client_service_contracts_signed_path_len
  check (signed_storage_path is null or char_length(signed_storage_path) <= 300);

insert into storage.buckets (id, name, public)
values ('registration-contracts', 'registration-contracts', false)
on conflict (id) do nothing;
