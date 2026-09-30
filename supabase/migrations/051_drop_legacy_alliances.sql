-- El CRM de alianzas ya no tiene pantallas ni jobs.
-- Los contratos de registro viven en client_service_contracts y no se tocan aquí.
-- Borrar estas tablas elimina fichas, plantillas, recordatorios y archivos de alianza.

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    delete from storage.objects where bucket_id = 'alliance-files';
    delete from storage.buckets where id = 'alliance-files';
  end if;
end $$;

drop table if exists public.alliance_contract_signers;
drop table if exists public.alliance_files;
drop table if exists public.alliance_contracts;
drop table if exists public.alliance_contract_templates;
drop table if exists public.alliance_contacts;
drop table if exists public.alliance_agreements;
drop table if exists public.alliance_activities;
drop table if exists public.alliance_reminders;
drop table if exists public.alliances;

drop function if exists public.alliance_touch_updated_at();
