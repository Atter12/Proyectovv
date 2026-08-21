-- 016: Reparar public.profiles (legacy Clerk → schema Holistic / auth.users)
-- Prod tenía: clerk_user_id, email, full_name, avatar_url, created_at, updated_at
-- App espera: id uuid (= auth.users.id), email_verified, status, onboarding_status, ...

-- Dominio email (001) si no existe
DO $$
BEGIN
  CREATE DOMAIN public.email AS text
    CHECK (VALUE ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Quitar FK legacy memberships → profiles (tabla Clerk)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'memberships'
      AND c.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Guardar tabla Clerk si todavía es el esquema viejo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'clerk_user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE public.profiles RENAME CONSTRAINT profiles_pkey TO profiles_clerk_legacy_pkey;
    ALTER TABLE public.profiles RENAME TO profiles_clerk_legacy;
  END IF;
END $$;

-- Crear profiles Holistic si falta
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email public.email NOT NULL,
  full_name text,
  avatar_url text,
  phone text,
  status public.user_profile_status NOT NULL DEFAULT 'email_pending',
  email_verified boolean NOT NULL DEFAULT false,
  onboarding_status public.onboarding_status NOT NULL DEFAULT 'email_verification_pending',
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Unique email (idempotente)
DO $$
BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- Backfill desde auth.users
INSERT INTO public.profiles (
  id, email, full_name, avatar_url, status, email_verified, onboarding_status, created_at, updated_at
)
SELECT
  u.id,
  lower(u.email)::public.email,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', ''),
    split_part(u.email, '@', 1)
  ),
  NULLIF(u.raw_user_meta_data->>'avatar_url', ''),
  'active'::public.user_profile_status,
  true,
  'completed'::public.onboarding_status,
  COALESCE(u.created_at, now()),
  now()
FROM auth.users u
WHERE u.email IS NOT NULL
  AND u.email <> ''
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
  email_verified = true,
  status = 'active',
  onboarding_status = 'completed',
  updated_at = now();

-- Enriquecer desde legacy Clerk por email (si existe)
DO $$
BEGIN
  IF to_regclass('public.profiles_clerk_legacy') IS NOT NULL THEN
    UPDATE public.profiles p
    SET
      full_name = COALESCE(NULLIF(p.full_name, ''), l.full_name, p.full_name),
      avatar_url = COALESCE(p.avatar_url, l.avatar_url),
      updated_at = now()
    FROM public.profiles_clerk_legacy l
    WHERE lower(p.email::text) = lower(l.email);
  END IF;
END $$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS básico
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
