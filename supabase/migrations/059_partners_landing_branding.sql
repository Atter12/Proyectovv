-- Landing del aliado al estilo «Setup your website»: color secundario, fondo y
-- texto propios, tamaño del logo, favicon y banners (computadora y celular).
-- Todo es opcional: sin valor, la landing usa el tema claro/oscuro de siempre.
alter table public.partners
  add column if not exists secondary_color text,
  add column if not exists background_color text,
  add column if not exists text_color text,
  add column if not exists logo_size smallint,
  add column if not exists favicon_url text,
  add column if not exists banner_url text,
  add column if not exists banner_mobile_url text,
  add column if not exists banner_link text;

alter table public.partners drop constraint if exists partners_branding_colors_chk;
alter table public.partners
  add constraint partners_branding_colors_chk check (
    (secondary_color is null or secondary_color ~ '^#[0-9a-fA-F]{6}$')
    and (background_color is null or background_color ~ '^#[0-9a-fA-F]{6}$')
    and (text_color is null or text_color ~ '^#[0-9a-fA-F]{6}$')
  );

alter table public.partners drop constraint if exists partners_logo_size_chk;
alter table public.partners
  add constraint partners_logo_size_chk check (logo_size is null or logo_size between 20 and 120);

alter table public.partners drop constraint if exists partners_banner_link_chk;
alter table public.partners
  add constraint partners_banner_link_chk check (banner_link is null or (banner_link ~ '^https://' and char_length(banner_link) <= 300));

-- Banners pesan más que un logo y el favicon puede venir en .ico.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']
where id = 'partner-assets';
