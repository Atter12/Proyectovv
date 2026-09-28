-- Volver de NAS no abre el panel. El acceso sale de una captura revisada.

alter table public.client_service_contracts
  add column if not exists payment_proof_status text not null default 'none',
  add column if not exists payment_proof_path text,
  add column if not exists payment_proof_hash text,
  add column if not exists payment_proof_reference text,
  add column if not exists payment_proof_reason text,
  add column if not exists payment_reviewed_at timestamptz;

alter table public.client_service_contracts
  drop constraint if exists client_service_contracts_payment_proof_status;
alter table public.client_service_contracts
  add constraint client_service_contracts_payment_proof_status
  check (payment_proof_status in ('none', 'pending_review', 'approved', 'rejected'));

create unique index if not exists client_service_contracts_payment_proof_hash_uidx
  on public.client_service_contracts (payment_proof_hash)
  where payment_proof_hash is not null;
