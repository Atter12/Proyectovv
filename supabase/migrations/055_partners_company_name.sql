-- Landing del aliado: nombre de la empresa aparte del nombre de la persona.
-- partners.name = la persona que recomienda; company_name = su empresa/marca.
alter table public.partners
  add column if not exists company_name text;

alter table public.partners drop constraint if exists partners_company_name_len;
alter table public.partners
  add constraint partners_company_name_len check (company_name is null or char_length(company_name) <= 80);
