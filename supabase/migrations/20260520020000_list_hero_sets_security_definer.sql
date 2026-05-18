-- Fix 401 (PG 42501) on POST /rest/v1/rpc/list_hero_sets when called as anon.
--
-- The function (defined in 20260519000000_variants_fixes.sql) joins
-- public.variant_votes in its `recent` CTE to compute the 30-day vote delta.
-- It is LANGUAGE sql STABLE — NOT SECURITY DEFINER — so it executes with
-- the caller's privileges. But:
--   * anon has no SELECT grant on variant_votes (only REFERENCES/TRIGGER/
--     TRUNCATE/MAINTAIN — see 20260518000000_team_variants.sql)
--   * The sole SELECT policy variant_votes_self_select targets authenticated
--     users and only exposes their own votes
-- PostgREST surfaces the resulting `permission denied for table variant_votes`
-- as HTTP 401 with PG code 42501, leaving the 精選隊伍 grid empty.
--
-- Aggregated counts don't leak individual vote rows, so SECURITY DEFINER is
-- the right fix. search_path is pinned to public per Supabase guidance.

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
SECURITY DEFINER
SET search_path = public
AS $$
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
