-- Reuniones de soporte. El cliente agenda un bloque; un asesor confirma
-- el enlace. La escritura pasa por el service role de la API.

create table if not exists public.support_advisor_schedules (
  email text primary key,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null,
  weekday_mask smallint not null default 31,
  start_minute smallint not null default 540,
  end_minute smallint not null default 1080,
  break_start_minute smallint not null default 780,
  break_end_minute smallint not null default 840,
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint support_advisor_name_len check (char_length(display_name) between 2 and 40),
  constraint support_advisor_mask_chk check (weekday_mask between 0 and 127),
  constraint support_advisor_hours_chk check (
    start_minute >= 0
    and start_minute < end_minute
    and end_minute <= 1440
    and break_start_minute >= start_minute
    and break_end_minute <= end_minute
    and break_end_minute > break_start_minute
  )
);

create table if not exists public.support_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  requester_user_id uuid not null references auth.users (id) on delete cascade,
  requester_name text not null,
  requester_email text not null,
  requester_phone text,
  advisor_user_id uuid references auth.users (id) on delete set null,
  advisor_name text,
  advisor_email text,
  subject text not null,
  notes text,
  meeting_type text not null default 'consulta',
  channel text not null default 'google_meet',
  meet_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending',
  client_reminder_at timestamptz,
  advisor_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_meetings_subject_len check (char_length(subject) between 3 and 160),
  constraint support_meetings_notes_len check (notes is null or char_length(notes) <= 2000),
  constraint support_meetings_phone_len check (
    requester_phone is null or char_length(requester_phone) <= 40
  ),
  constraint support_meetings_url_len check (meet_url is null or char_length(meet_url) <= 300),
  constraint support_meetings_time_chk check (ends_at > starts_at),
  constraint support_meetings_type_chk check (
    meeting_type in (
      'consulta',
      'onboarding',
      'revision',
      'estrategia',
      'seguimiento',
      'soporte'
    )
  ),
  constraint support_meetings_status_chk check (
    status in (
      'pending',
      'confirmed',
      'completed',
      'rescheduled',
      'cancelled',
      'no_show'
    )
  )
);

create index if not exists support_meetings_starts_idx
  on public.support_meetings (starts_at);

create index if not exists support_meetings_requester_idx
  on public.support_meetings (requester_user_id, starts_at desc);

create index if not exists support_meetings_status_idx
  on public.support_meetings (status, starts_at);

drop trigger if exists support_advisor_schedules_updated_at on public.support_advisor_schedules;
create trigger support_advisor_schedules_updated_at
  before update on public.support_advisor_schedules
  for each row execute function public.set_updated_at();

drop trigger if exists support_meetings_updated_at on public.support_meetings;
create trigger support_meetings_updated_at
  before update on public.support_meetings
  for each row execute function public.set_updated_at();

alter table public.support_advisor_schedules enable row level security;
alter table public.support_meetings enable row level security;

-- Horarios iniciales del equipo de soporte (Lima). Lun=bit 0 … Dom=bit 6.
insert into public.support_advisor_schedules (
  email,
  display_name,
  weekday_mask,
  start_minute,
  end_minute,
  break_start_minute,
  break_end_minute,
  is_available
)
values
  ('branlyn.lopez.r@gmail.com', 'Branlyn', 31, 480, 1020, 720, 780, true),
  ('anniealejandrova6@gmail.com', 'Annie', 63, 540, 1080, 780, 840, true),
  ('freddyjgt258@gmail.com', 'Freddy', 31, 480, 1020, 780, 840, true),
  ('sebasnodeal@gmail.com', 'Sebas', 63, 600, 1140, 840, 900, true)
on conflict (email) do nothing;
