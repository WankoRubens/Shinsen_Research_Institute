-- Follow-up fixes from the design review of the variant-first feature.
-- Functions are recreated via CREATE OR REPLACE so this migration is safe to
-- apply whether or not the original (20260518000000_team_variants.sql) is
-- already in place — Postgres treats CREATE OR REPLACE as either CREATE or
-- in-place body update, depending on prior state.
--
-- Two correctness/performance regressions are addressed:
--
--   1. withdraw_variant had a TOCTOU window where two concurrent withdrawals
--      on the same variant could both observe v_was_first = false, both
--      delete their contributor row, race to the "is anyone left?" check,
--      and end up deleting the variant without transferring credit — vote
--      history lost silently. Fix: take a FOR UPDATE row lock on the variant
--      at the top of the function so the (read first_author → delete row →
--      count remaining → maybe-transfer) sequence is serialized per variant.
--      The return shape also gains a `transferred` boolean so the client can
--      distinguish "first_author changed" from "caller wasn't first_author".
--
--   2. list_hero_sets executed four correlated scalar subqueries per row
--      (variant_count, total_vote_count, total_upvote_count, last_active_at).
--      With N hero sets that's 4N full scans of team_variants — landing-page
--      latency that scales linearly with data size. Fix: pre-aggregate
--      everything in a single GROUP BY hero_set_hash CTE, then JOIN once.

-- 1. withdraw_variant: lock + clearer return shape ----------------------
CREATE OR REPLACE FUNCTION "public"."withdraw_variant"(p_variant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user        uuid := auth.uid();
    v_remaining   int;
    v_new_first   uuid;
    v_was_first   boolean := false;
    v_old_first   uuid;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'auth required';
    END IF;

    -- Serialize concurrent withdrawals on the same variant. Without this
    -- lock two callers can both read first_author before either has deleted
    -- its contributor row, both see v_was_first based on a stale snapshot,
    -- and the variant can be dropped without transferring credit even when
    -- one of them was the original author.
    SELECT first_author
      INTO v_old_first
      FROM public.team_variants
     WHERE id = p_variant_id
     FOR UPDATE;

    -- p_variant_id doesn't exist (already deleted by a concurrent caller).
    -- Idempotent success: nothing to do.
    IF NOT FOUND THEN
        RETURN jsonb_build_object('deleted', true, 'transferred', false);
    END IF;

    v_was_first := (v_old_first = v_user);

    DELETE FROM public.variant_contributors
     WHERE variant_id = p_variant_id AND user_id = v_user;

    SELECT count(*) INTO v_remaining
      FROM public.variant_contributors
     WHERE variant_id = p_variant_id;

    IF v_remaining = 0 THEN
        DELETE FROM public.team_variants WHERE id = p_variant_id;
        RETURN jsonb_build_object('deleted', true, 'transferred', false);
    END IF;

    IF v_was_first THEN
        SELECT user_id INTO v_new_first
          FROM public.variant_contributors
         WHERE variant_id = p_variant_id
         ORDER BY contributed_at ASC
         LIMIT 1;
        UPDATE public.team_variants
           SET first_author = v_new_first
         WHERE id = p_variant_id;
        RETURN jsonb_build_object(
            'deleted', false,
            'transferred', true,
            'first_author', v_new_first
        );
    END IF;

    RETURN jsonb_build_object('deleted', false, 'transferred', false);
END;
$$;


-- 2. list_hero_sets: GROUP BY aggregation in a single pass --------------
CREATE OR REPLACE FUNCTION "public"."list_hero_sets"(p_limit int DEFAULT 60, p_offset int DEFAULT 0)
RETURNS TABLE(
    hero_set_hash      text,
    sample_variant_id  uuid,
    sample_team_blob   jsonb,
    variant_count      bigint,
    total_vote_count   bigint,
    total_upvote_count bigint,
    last_active_at     timestamptz,
    recent_vote_delta  bigint
)
LANGUAGE sql
STABLE
AS $$
    -- aggregates: one row per hero_set, computed in a single scan instead
    -- of four correlated subqueries per ranked row (see migration header).
    WITH aggregates AS (
        SELECT
            tv.hero_set_hash,
            count(*)             AS variant_count,
            sum(tv.vote_count)   AS total_vote_count,
            sum(tv.upvote_count) AS total_upvote_count,
            max(tv.updated_at)   AS last_active_at
        FROM public.team_variants tv
        GROUP BY tv.hero_set_hash
    ),
    -- representative variant per set: the top-voted one (ties broken by
    -- most-recent activity). Provides the team_blob the frontend uses to
    -- extract portraits and hero names for the HeroSet card.
    ranked AS (
        SELECT
            tv.hero_set_hash,
            tv.id        AS variant_id,
            tv.team_blob,
            row_number() OVER (
                PARTITION BY tv.hero_set_hash
                ORDER BY tv.vote_count DESC, tv.updated_at DESC
            ) AS rn
        FROM public.team_variants tv
    ),
    -- 30-day net vote delta per hero_set. LEFT JOINed below so hero_sets
    -- with no recent activity surface a 0 instead of dropping out.
    recent AS (
        SELECT
            tv.hero_set_hash,
            count(*) FILTER (WHERE vv.value = 1)  -
            count(*) FILTER (WHERE vv.value = -1) AS delta
        FROM public.team_variants tv
        JOIN public.variant_votes vv ON vv.variant_id = tv.id
        WHERE vv.created_at > now() - interval '30 days'
        GROUP BY tv.hero_set_hash
    )
    SELECT
        a.hero_set_hash,
        r.variant_id     AS sample_variant_id,
        r.team_blob      AS sample_team_blob,
        a.variant_count,
        a.total_vote_count,
        a.total_upvote_count,
        a.last_active_at,
        COALESCE(rec.delta, 0) AS recent_vote_delta
    FROM aggregates a
    JOIN ranked r ON r.hero_set_hash = a.hero_set_hash AND r.rn = 1
    LEFT JOIN recent rec ON rec.hero_set_hash = a.hero_set_hash
    ORDER BY a.total_vote_count DESC, a.last_active_at DESC
    LIMIT p_limit OFFSET p_offset;
$$;
