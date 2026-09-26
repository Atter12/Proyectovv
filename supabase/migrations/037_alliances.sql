-- Fase 1 del módulo Marketing > Alianzas.
-- La alianza es la entidad principal. Contratos, contactos, acuerdos,
-- actividades, recordatorios y archivos cuelgan de ella.
-- Escritura solo con service role del panel admin. Sin políticas para clientes.

create or replace function public.alliance_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.alliances (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alliance_type text not null,
  status text not null default 'negotiating',
  owner_name text not null,
  contact_name text,
  phone text,
  email text,
  started_on date,
  ends_on date,
  summary text,
  our_contribution text,
  their_contribution text,
  commission_terms text,
  next_action text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alliances_name_len check (char_length(name) between 2 and 160),
  constraint alliances_owner_len check (char_length(owner_name) between 2 and 120),
  constraint alliances_type_chk check (
    alliance_type in ('ecommerce', 'agency', 'commercial', 'partner', 'other')
  ),
  constraint alliances_status_chk check (
    status in ('negotiating', 'active', 'paused', 'ended')
  ),
  constraint alliances_dates_chk check (
    started_on is null or ends_on is null or ends_on >= started_on
  )
);

create table if not exists public.alliance_contacts (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances (id) on delete cascade,
  name text not null,
  role_title text,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alliance_contacts_name_len check (char_length(name) between 2 and 120)
);

create table if not exists public.alliance_agreements (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances (id) on delete cascade,
  title text not null,
  kind text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alliance_agreements_kind_chk check (
    kind in (
      'commission',
      'responsibility',
      'deliverable',
      'exclusivity',
      'territory',
      'target',
      'other'
    )
  )
);

create table if not exists public.alliance_contracts (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances (id) on delete cascade,
  contract_type text not null,
  version integer not null default 1,
  status text not null default 'draft',
  sent_on date,
  expires_on date,
  notes text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  signature_provider text not null default 'manual',
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alliance_contracts_version_chk check (version between 1 and 99),
  constraint alliance_contracts_type_chk check (
    contract_type in ('commercial', 'nda', 'addendum', 'renewal', 'other')
  ),
  constraint alliance_contracts_status_chk check (
    status in (
      'draft',
      'in_review',
      'pending_signature',
      'signed',
      'expiring',
      'expired',
      'renewed'
    )
  )
);

create table if not exists public.alliance_contract_signers (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.alliance_contracts (id) on delete cascade,
  name text not null,
  email text,
  role_title text,
  signed_on date,
  created_at timestamptz not null default now(),
  constraint alliance_contract_signers_name_len check (char_length(name) between 2 and 120)
);

create table if not exists public.alliance_activities (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  occurred_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint alliance_activities_kind_chk check (
    kind in ('meeting', 'call', 'agreement', 'message', 'incident', 'change')
  )
);

create table if not exists public.alliance_reminders (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances (id) on delete cascade,
  title text not null,
  due_on date not null,
  priority text not null default 'normal',
  status text not null default 'open',
  owner_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alliance_reminders_priority_chk check (priority in ('low', 'normal', 'high')),
  constraint alliance_reminders_status_chk check (status in ('open', 'done', 'cancelled'))
);

create table if not exists public.alliance_files (
  id uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances (id) on delete cascade,
  contract_id uuid references public.alliance_contracts (id) on delete cascade,
  name text not null,
  category text not null default 'other',
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint alliance_files_category_chk check (
    category in ('proposal', 'annex', 'presentation', 'commercial', 'legal', 'other')
  )
);

create index if not exists idx_alliances_status_type
  on public.alliances (status, alliance_type);
create index if not exists idx_alliance_contacts_alliance
  on public.alliance_contacts (alliance_id);
create index if not exists idx_alliance_agreements_alliance
  on public.alliance_agreements (alliance_id);
create index if not exists idx_alliance_contracts_alliance
  on public.alliance_contracts (alliance_id, status);
create index if not exists idx_alliance_activities_alliance
  on public.alliance_activities (alliance_id, occurred_at desc);
create index if not exists idx_alliance_reminders_due
  on public.alliance_reminders (status, due_on);
create index if not exists idx_alliance_files_alliance
  on public.alliance_files (alliance_id, created_at desc);

drop trigger if exists trg_alliances_touch on public.alliances;
create trigger trg_alliances_touch
  before update on public.alliances
  for each row execute function public.alliance_touch_updated_at();

drop trigger if exists trg_alliance_contacts_touch on public.alliance_contacts;
create trigger trg_alliance_contacts_touch
  before update on public.alliance_contacts
  for each row execute function public.alliance_touch_updated_at();

drop trigger if exists trg_alliance_agreements_touch on public.alliance_agreements;
create trigger trg_alliance_agreements_touch
  before update on public.alliance_agreements
  for each row execute function public.alliance_touch_updated_at();

drop trigger if exists trg_alliance_contracts_touch on public.alliance_contracts;
create trigger trg_alliance_contracts_touch
  before update on public.alliance_contracts
  for each row execute function public.alliance_touch_updated_at();

drop trigger if exists trg_alliance_reminders_touch on public.alliance_reminders;
create trigger trg_alliance_reminders_touch
  before update on public.alliance_reminders
  for each row execute function public.alliance_touch_updated_at();

alter table public.alliances enable row level security;
alter table public.alliance_contacts enable row level security;
alter table public.alliance_agreements enable row level security;
alter table public.alliance_contracts enable row level security;
alter table public.alliance_contract_signers enable row level security;
alter table public.alliance_activities enable row level security;
alter table public.alliance_reminders enable row level security;
alter table public.alliance_files enable row level security;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('alliance-files', 'alliance-files', false)
    on conflict (id) do nothing;
  end if;
end $$;
