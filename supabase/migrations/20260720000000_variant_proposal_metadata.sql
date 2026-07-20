-- Store each contributor's lineup name and comment for the public variant feed.

ALTER TABLE public.variant_contributors
  ADD COLUMN IF NOT EXISTS proposal_name text,
  ADD COLUMN IF NOT EXISTS proposal_comment text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'variant_contributors_proposal_name_length'
  ) THEN
    ALTER TABLE public.variant_contributors
      ADD CONSTRAINT variant_contributors_proposal_name_length
      CHECK (proposal_name IS NULL OR char_length(proposal_name) <= 50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'variant_contributors_proposal_comment_length'
  ) THEN
    ALTER TABLE public.variant_contributors
      ADD CONSTRAINT variant_contributors_proposal_comment_length
      CHECK (proposal_comment IS NULL OR char_length(proposal_comment) <= 500);
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.submit_variant(jsonb, text);

CREATE OR REPLACE FUNCTION public.submit_variant(
  p_team jsonb,
  p_author_name text DEFAULT NULL,
  p_proposal_name text DEFAULT NULL,
  p_proposal_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user                    uuid := auth.uid();
  v_variant_hash            text;
  v_hero_set_hash           text;
  v_variant_id              uuid;
  v_is_new                  boolean := false;
  v_capped_author_name      text;
  v_capped_proposal_name    text;
  v_capped_proposal_comment text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT h.variant_hash, h.hero_set_hash
    INTO v_variant_hash, v_hero_set_hash
    FROM public.compute_variant_hashes(p_team) h;

  IF (p_team->'main'->'hero'->>'name') IS NULL THEN
    RAISE EXCEPTION 'main hero required';
  END IF;

  v_capped_author_name := CASE
    WHEN NULLIF(btrim(p_author_name), '') IS NULL THEN NULL
    ELSE left(btrim(p_author_name), 10)
  END;
  v_capped_proposal_name := CASE
    WHEN NULLIF(btrim(p_proposal_name), '') IS NULL THEN NULL
    ELSE left(btrim(p_proposal_name), 50)
  END;
  v_capped_proposal_comment := CASE
    WHEN NULLIF(btrim(p_proposal_comment), '') IS NULL THEN NULL
    ELSE left(btrim(p_proposal_comment), 500)
  END;

  INSERT INTO public.team_variants
    (variant_hash, hero_set_hash, team_blob, first_author)
  VALUES
    (v_variant_hash, v_hero_set_hash, p_team, v_user)
  ON CONFLICT (variant_hash) DO NOTHING
  RETURNING id INTO v_variant_id;

  IF v_variant_id IS NOT NULL THEN
    v_is_new := true;
  ELSE
    SELECT id INTO v_variant_id
      FROM public.team_variants
     WHERE variant_hash = v_variant_hash;
  END IF;

  INSERT INTO public.variant_contributors (
    variant_id,
    user_id,
    author_name,
    proposal_name,
    proposal_comment
  )
  VALUES (
    v_variant_id,
    v_user,
    v_capped_author_name,
    v_capped_proposal_name,
    v_capped_proposal_comment
  )
  ON CONFLICT (variant_id, user_id) DO UPDATE
    SET author_name = EXCLUDED.author_name,
        proposal_name = EXCLUDED.proposal_name,
        proposal_comment = EXCLUDED.proposal_comment;

  RETURN jsonb_build_object(
    'variant_id', v_variant_id,
    'variant_hash', v_variant_hash,
    'hero_set_hash', v_hero_set_hash,
    'is_new', v_is_new
  );
END;
$$;

ALTER FUNCTION public.submit_variant(jsonb, text, text, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.submit_variant(jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_variant(jsonb, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
