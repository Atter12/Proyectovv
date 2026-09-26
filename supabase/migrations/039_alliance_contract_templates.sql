-- Fase 2: plantillas para generar el borrador del contrato.

create table if not exists public.alliance_contract_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  contract_type text not null,
  description text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alliance_contract_templates_name_len check (char_length(name) between 2 and 120),
  constraint alliance_contract_templates_body_len check (char_length(body) between 20 and 12000),
  constraint alliance_contract_templates_type_chk check (
    contract_type in ('commercial', 'nda', 'addendum', 'renewal', 'other')
  )
);

alter table public.alliance_contracts
  add column if not exists template_id uuid references public.alliance_contract_templates (id) on delete set null;

drop trigger if exists trg_alliance_contract_templates_touch on public.alliance_contract_templates;
create trigger trg_alliance_contract_templates_touch
  before update on public.alliance_contract_templates
  for each row execute function public.alliance_touch_updated_at();

alter table public.alliance_contract_templates enable row level security;

insert into public.alliance_contract_templates (slug, name, contract_type, description, body)
values
  (
    'alianza-comercial',
    'Alianza comercial',
    'commercial',
    'Acuerdo base entre Holistic y un ecommerce, agencia o partner.',
    $tpl$
# Acuerdo de alianza comercial

En {{ciudad}}, el {{hoy}}, Holistic Marketing y {{alianza}} registran las condiciones de esta relación.

## Partes
Holistic Marketing, con seguimiento interno de {{responsable}}.
{{alianza}}, {{tipo}}, representada por {{contacto}}. Correo: {{correo}}. Teléfono: {{telefono}}.

## Objeto
{{acuerdo}}

Holistic aporta: {{aporta_holistic}}

La otra parte aporta: {{aporta_contraparte}}

## Contraprestación
{{comision}}

## Vigencia
El acuerdo corre desde {{inicio}} hasta {{termino}}, salvo que las partes lo cierren por escrito.

## Cierre
Este documento es un borrador para revisión. Queda pendiente de firma y no reemplaza el archivo firmado.
$tpl$
  ),
  (
    'nda',
    'Acuerdo de confidencialidad',
    'nda',
    'NDA corto antes de compartir condiciones comerciales.',
    $tpl$
# Acuerdo de confidencialidad

En {{ciudad}}, el {{hoy}}, Holistic Marketing y {{alianza}} acuerdan resguardar la información que se compartan.

## Partes
Holistic Marketing, contacto interno {{responsable}}.
{{alianza}}, contacto {{contacto}} ({{correo}}).

## Alcance
Se considera confidencial lo relativo a {{acuerdo}}, incluidos números, creativos, cuentas y condiciones que no sean públicas.

## Uso
Cada parte usa esa información solo para evaluar o ejecutar la relación, y no la comparte con terceros salvo obligación legal o personal que necesite conocerla.

## Vigencia
La reserva corre desde {{inicio}} y se mantiene después del {{termino}}.

## Cierre
Borrador para revisión. La firma electrónica se inicia en un paso posterior.
$tpl$
  ),
  (
    'adenda',
    'Adenda',
    'addendum',
    'Cambio puntual sobre una alianza que ya existe.',
    $tpl$
# Adenda

En {{ciudad}}, el {{hoy}}, Holistic Marketing y {{alianza}} modifican lo ya acordado, sin reemplazar el resto del contrato vigente.

## Cambio
{{acuerdo}}

## Contraprestación actualizada
{{comision}}

## Vigencia de este cambio
Aplica desde {{inicio}} hasta {{termino}}.

## Confirmación
Lo revisan {{responsable}} por Holistic y {{contacto}} por {{alianza}}. Este texto es un borrador hasta la firma.
$tpl$
  )
on conflict (slug) do nothing;
