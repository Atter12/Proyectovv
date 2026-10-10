-- Alianzas con fee preferencial (p. ej. Jerson Artezano): el aliado no gana
-- comisión; él y sus clientes pagan un fee rebajado. Cada cliente que entra por
-- su link o se le asigna queda con este % en Hecom (ficha y cuentas TikTok).
-- Null = la alianza no cambia el fee de sus clientes.
alter table public.partners
  add column if not exists client_fee_percent numeric(5, 2);

alter table public.partners drop constraint if exists partners_client_fee_chk;
alter table public.partners
  add constraint partners_client_fee_chk check (client_fee_percent is null or (client_fee_percent >= 0 and client_fee_percent <= 50));

-- Jerson Artezano: según su contrato, él y sus chicos pagan 3 % de fee.
update public.partners set client_fee_percent = 3 where slug = 'jerson-artezano';
