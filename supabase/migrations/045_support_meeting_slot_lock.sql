-- Un asesor no puede tener dos reuniones activas a la misma hora.
-- El índice cierra la carrera en la que dos clientes confirman el mismo bloque.

create unique index if not exists support_meetings_advisor_slot_uidx
  on public.support_meetings (advisor_email, starts_at)
  where advisor_email is not null
    and status in ('pending', 'confirmed', 'rescheduled');
