ALTER TABLE public.character_profiles
  ADD COLUMN IF NOT EXISTS inv_bt jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.character_profiles.inv_bt IS
  'Owned hero breakthrough counts keyed by canonical Japanese hero name; omitted keys mean 0.';
