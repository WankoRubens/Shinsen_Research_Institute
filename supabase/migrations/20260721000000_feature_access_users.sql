-- Three-tier page access:
--   admin  - all pages and access management
--   member - all pages except settings
--   no row - the five public pages only

CREATE TABLE IF NOT EXISTS public.feature_access_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_role text NOT NULL DEFAULT 'member',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_access_users
  ADD COLUMN IF NOT EXISTS access_role text NOT NULL DEFAULT 'member';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feature_access_users_role_check'
      AND conrelid = 'public.feature_access_users'::regclass
  ) THEN
    ALTER TABLE public.feature_access_users
      ADD CONSTRAINT feature_access_users_role_check
      CHECK (access_role IN ('admin', 'member'));
  END IF;
END
$$;

ALTER TABLE public.feature_access_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_access_users_self_select
  ON public.feature_access_users;

CREATE POLICY feature_access_users_self_select
  ON public.feature_access_users
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.feature_access_users FROM anon;
REVOKE ALL ON TABLE public.feature_access_users FROM authenticated;
GRANT SELECT ON TABLE public.feature_access_users TO authenticated;
GRANT ALL ON TABLE public.feature_access_users TO service_role;

-- Kept private so only the SECURITY DEFINER management RPCs use it.
CREATE OR REPLACE FUNCTION public.is_feature_access_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.feature_access_users
    WHERE user_id = auth.uid()
      AND access_role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_feature_access_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_feature_access_admin() TO service_role;

-- Admin-only user directory used by the settings screen.
CREATE OR REPLACE FUNCTION public.list_feature_access_users()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  email text,
  provider text,
  access_role text,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_feature_access_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    users.id,
    COALESCE(
      NULLIF(BTRIM(users.raw_user_meta_data ->> 'display_name'), ''),
      NULLIF(BTRIM(users.raw_user_meta_data ->> 'user_name'), ''),
      NULLIF(BTRIM(users.raw_user_meta_data ->> 'preferred_username'), ''),
      NULLIF(BTRIM(users.raw_user_meta_data ->> 'name'), ''),
      NULLIF(SPLIT_PART(users.email, '@', 1), ''),
      'User'
    ),
    COALESCE(users.email::text, ''),
    COALESCE(users.raw_app_meta_data ->> 'provider', ''),
    COALESCE(access.access_role, 'general'),
    users.last_sign_in_at
  FROM auth.users AS users
  LEFT JOIN public.feature_access_users AS access ON access.user_id = users.id
  ORDER BY
    CASE COALESCE(access.access_role, 'general')
      WHEN 'admin' THEN 0
      WHEN 'member' THEN 1
      ELSE 2
    END,
    users.last_sign_in_at DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.list_feature_access_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_feature_access_users() TO authenticated, service_role;

-- Admins may grant or revoke member access. Admin rows cannot be changed here.
CREATE OR REPLACE FUNCTION public.set_feature_access_role(
  p_user_id uuid,
  p_access_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  target_role text;
BEGIN
  IF NOT public.is_feature_access_admin() THEN
    RAISE EXCEPTION 'administrator access required' USING ERRCODE = '42501';
  END IF;

  IF p_access_role NOT IN ('member', 'general') THEN
    RAISE EXCEPTION 'access role must be member or general' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT access_role
  INTO target_role
  FROM public.feature_access_users
  WHERE user_id = p_user_id;

  IF target_role = 'admin' THEN
    RAISE EXCEPTION 'administrator access cannot be changed here' USING ERRCODE = '42501';
  END IF;

  IF p_access_role = 'general' THEN
    DELETE FROM public.feature_access_users
    WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.feature_access_users (user_id, access_role)
    VALUES (p_user_id, 'member')
    ON CONFLICT (user_id) DO UPDATE
      SET access_role = EXCLUDED.access_role;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_feature_access_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_feature_access_role(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
