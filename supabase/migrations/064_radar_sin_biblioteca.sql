-- Radar sin biblioteca: los videos de TikTok se buscan en vivo en cada ronda y
-- se muestran con el reproductor oficial. No se guarda ningún video, enlace ni
-- reacción por video; del cliente solo queda su perfil y su gusto agregado
-- (radar_client_profiles) y sus recetas (radar_recipes).
--
-- Aplicar DESPUÉS de desplegar el código que ya no usa estas tablas.

DROP TABLE IF EXISTS public.radar_reactions;
DROP TABLE IF EXISTS public.radar_video_sources;
DROP TABLE IF EXISTS public.radar_videos;
DROP TABLE IF EXISTS public.radar_hashtags;

COMMENT ON COLUMN public.radar_recipes.input_video_ids IS
  'Vacío desde 064: los videos de referencia se buscan en vivo y no se guardan.';

select table_name from information_schema.tables
where table_schema = 'public' and table_name like 'radar_%'
order by 1;
