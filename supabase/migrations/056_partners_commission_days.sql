-- La comisión del aliado dura 50 días desde que se registra cada cliente (no 12 meses).
-- commission_days reemplaza a commission_months (que queda sin uso).
alter table public.partners
  add column if not exists commission_days integer not null default 50;

alter table public.partners drop constraint if exists partners_commission_days;
alter table public.partners
  add constraint partners_commission_days check (commission_days between 1 and 3650);

update public.partners set commission_days = 50;

-- Clientes ya atribuidos: su vencimiento pasa a la regla en días.
update public.partner_clients pc
   set expires_at = pc.attributed_at + make_interval(days => p.commission_days)
  from public.partners p
 where p.id = pc.partner_id;
