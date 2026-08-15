-- Asegura estados de ticket usados por Inbox Soporte / admin.
-- En algunos entornos el enum nació sin 'resolved'.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'support_ticket_status'
      AND e.enumlabel = 'resolved'
  ) THEN
    ALTER TYPE public.support_ticket_status ADD VALUE 'resolved';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
