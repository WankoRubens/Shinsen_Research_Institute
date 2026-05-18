-- Variant-first refactor of the 精選隊伍 (featured teams) feature.
--
-- Motivation: under the legacy proposals model each (user, team) submission is
-- its own row. When multiple users publish the same composition + skills the
-- public feed shows duplicates and votes get diluted. The new model promotes
-- "canonical variant" to a first-class entity:
--
--   - HeroSet   = which 3 heroes (主將 distinct from sorted {副將, 副將})
--   - Variant   = HeroSet + per-hero skills + 兵學 + breakthrough
--   - Vote      = attached to a variant; one (variant, user) row
--   - Contributor = every user who tried to submit this exact variant
--
-- Hashes are computed server-side from team_blob; clients never send a hash.
-- This avoids client/server divergence and makes the hash logic the single
-- source of truth. The hash captures identity-bearing fields only — portraits,
-- stats, trait blobs and other downstream data are ignored.
--
-- Tables introduced:
--   - team_variants          one row per canonical variant; PK id, UNIQUE variant_hash
--   - variant_contributors   join table tracking every user who submitted this variant
--   - variant_votes          per-(variant, user) vote with signed value, mirrors proposal_votes
--
-- The legacy proposals / proposal_votes tables remain intact. Existing public
-- proposals are backfilled into variants so the new public feed lights up with
-- the current data set on day one. A follow-up migration can retire is_public
-- once the frontend has fully cut over.


-- 1. Canonical hash helpers --------------------------------------------------

-- Build a normalized JSONB signature for a single role (main or vice). Only
-- identity-bearing fields are extracted: hero name, the two skill names
-- (sorted — positional within skill1/skill2 is not meaningful for identity),
-- breakthrough level, and the 兵學 config (direction + major + sorted minors).
-- Returning JSONB (vs. plain text) lets the caller compose role signatures
-- into the variant signature without re-parsing.
CREATE OR REPLACE FUNCTION public.variant_role_signature(role jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_hero text;
  v_skills text[];
  v_minors text[];
  v_breakthrough int;
BEGIN
  v_hero := role->'hero'->>'name';

  -- Skills: collect non-null names, sort them. Positional (skill1 vs skill2)
  -- is a UI artefact, not an identity attribute — same two skills swapped
  -- between slots is the same variant.
  SELECT array_agg(s ORDER BY s) INTO v_skills
  FROM unnest(ARRAY[
    role->'skill1'->>'name',
    role->'skill2'->>'name'
  ]) AS s
  WHERE s IS NOT NULL;
  IF v_skills IS NULL THEN v_skills := ARRAY[]::text[]; END IF;

  -- Bingxue minors: collect "name::level" pairs, sort. Order of minors is
  -- not significant — the budgeted-points model treats {A:1, B:2} and
  -- {B:2, A:1} as the same allocation.
  SELECT array_agg(m ORDER BY m) INTO v_minors
  FROM (
    SELECT COALESCE(val->>'name', '') || '::' || COALESCE(val->>'level', '0') AS m
    FROM jsonb_array_elements(COALESCE(role->'bingxue'->'minors', '[]'::jsonb)) AS val
  ) sub;
  IF v_minors IS NULL THEN v_minors := ARRAY[]::text[]; END IF;

  -- Breakthrough is part of identity: it gates which traits are active, which
  -- changes effective combat behavior even when heroes/skills match.
  v_breakthrough := COALESCE((role->>'breakthrough')::int, 0);

  RETURN jsonb_build_object(
    'hero',        v_hero,
    'skills',      to_jsonb(v_skills),
    'breakthrough', v_breakthrough,
    'bingxue',     jsonb_build_object(
      'direction', role->'bingxue'->>'direction',
      'major',     role->'bingxue'->>'major',
      'minors',    to_jsonb(v_minors)
    )
  );
END;
$$;


-- Compute both hashes from a team_blob. Returns (variant_hash, hero_set_hash).
--
-- hero_set_hash distinguishes by (main hero, sorted vice heroes) — 主將 stays
-- separate because 主將技 triggers depend on which hero leads.
--
-- variant_hash extends that with per-hero (skills + 兵學 + breakthrough).
-- Vice signatures are sorted by hero name as a *bundle* so swapping the two
-- vice positions (which has no in-game effect) produces the same hash.
-- OUT parameters (not RETURNS TABLE) so the function is single-row composite,
-- not set-returning. Set-returning functions can't appear in WHERE clauses
-- (SQLSTATE 0A000), but `(compute_variant_hashes(x)).variant_hash` is valid
-- anywhere when the function is composite-typed. Callers using
-- `FROM compute_variant_hashes(x) h` still work — single-row composites are
-- treated as 1-row tables in FROM context.
CREATE OR REPLACE FUNCTION public.compute_variant_hashes(
    p_team jsonb,
    OUT variant_hash text,
    OUT hero_set_hash text
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_main_hero  text;
  v_vice1_hero text;
  v_vice2_hero text;
  v_main_sig   jsonb;
  v_vice1_sig  jsonb;
  v_vice2_sig  jsonb;
  v_vice_sigs  jsonb;
  v_set_input  text;
BEGIN
  v_main_hero  := p_team->'main'->'hero'->>'name';
  v_vice1_hero := p_team->'vice1'->'hero'->>'name';
  v_vice2_hero := p_team->'vice2'->'hero'->>'name';

  -- HeroSet hash: main pinned, vices sorted (NULL sorts low — empty slots
  -- produce a stable hash even on partial teams).
  IF COALESCE(v_vice1_hero, '') <= COALESCE(v_vice2_hero, '') THEN
    v_set_input := COALESCE(v_main_hero, '') || '::'
                || COALESCE(v_vice1_hero, '') || ',' || COALESCE(v_vice2_hero, '');
  ELSE
    v_set_input := COALESCE(v_main_hero, '') || '::'
                || COALESCE(v_vice2_hero, '') || ',' || COALESCE(v_vice1_hero, '');
  END IF;
  hero_set_hash := md5(v_set_input);

  -- Variant hash: full canonical signature.
  v_main_sig  := public.variant_role_signature(p_team->'main');
  v_vice1_sig := public.variant_role_signature(p_team->'vice1');
  v_vice2_sig := public.variant_role_signature(p_team->'vice2');

  -- Sort vice signature *bundles* by their hero name. This ensures swapping
  -- (vice1 ↔ vice2) with their respective skill/兵學 bundles produces the
  -- same canonical input. Compare hero names directly — they're the bundle
  -- identity within HeroSet scope.
  IF COALESCE(v_vice1_sig->>'hero', '') <= COALESCE(v_vice2_sig->>'hero', '') THEN
    v_vice_sigs := jsonb_build_array(v_vice1_sig, v_vice2_sig);
  ELSE
    v_vice_sigs := jsonb_build_array(v_vice2_sig, v_vice1_sig);
  END IF;

  variant_hash := md5(
    jsonb_build_object('main', v_main_sig, 'vices', v_vice_sigs)::text
  );
END;
$$;


-- 2. Tables ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."team_variants" (
    "id"               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    "variant_hash"     text          NOT NULL UNIQUE,
    "hero_set_hash"    text          NOT NULL,
    -- Frozen canonical team blob. Same shape as a Lineup snapshot. Display
    -- code derives portraits, skill descriptions, etc. from here.
    "team_blob"        jsonb         NOT NULL,
    "team_schema"      integer       NOT NULL DEFAULT 1,
    -- first_author is the original creator. Stays attached even if they
    -- delete their contributor row, so display credit remains stable. Set to
    -- NULL only when *all* contributors leave and the variant is orphaned.
    "first_author"     uuid          REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "first_submitted_at" timestamptz NOT NULL DEFAULT now(),
    -- Denormalized vote counters maintained by the variant_votes trigger.
    "vote_count"       integer       NOT NULL DEFAULT 0,
    "upvote_count"     integer       NOT NULL DEFAULT 0,
    "downvote_count"   integer       NOT NULL DEFAULT 0,
    "created_at"       timestamptz   NOT NULL DEFAULT now(),
    "updated_at"       timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT "variant_blob_size_limit" CHECK (octet_length(team_blob::text) < 50000)
);

ALTER TABLE "public"."team_variants" OWNER TO "postgres";
ALTER TABLE "public"."team_variants" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "team_variants_hero_set_idx"
    ON "public"."team_variants" ("hero_set_hash", "vote_count" DESC, "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "team_variants_score_idx"
    ON "public"."team_variants" ("vote_count" DESC, "updated_at" DESC);


CREATE TABLE IF NOT EXISTS "public"."variant_contributors" (
    "variant_id"      uuid         NOT NULL REFERENCES "public"."team_variants"("id") ON DELETE CASCADE,
    "user_id"         uuid         NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "contributed_at"  timestamptz  NOT NULL DEFAULT now(),
    -- Denormalized for cheap display: every contributor records what their
    -- author_name was at submission time. The frontend prefers a live JOIN
    -- on auth.users.user_metadata for the *first_author* line (so renames
    -- propagate), but the per-contributor list can show frozen snapshots if
    -- needed for "also submitted by" tooltips.
    "author_name"     text,
    PRIMARY KEY ("variant_id", "user_id")
);

ALTER TABLE "public"."variant_contributors" OWNER TO "postgres";
ALTER TABLE "public"."variant_contributors" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "variant_contributors_user_idx"
    ON "public"."variant_contributors" ("user_id", "contributed_at" DESC);


CREATE TABLE IF NOT EXISTS "public"."variant_votes" (
    "variant_id"  uuid         NOT NULL REFERENCES "public"."team_variants"("id") ON DELETE CASCADE,
    "user_id"     uuid         NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "value"       smallint     NOT NULL DEFAULT 1 CHECK ("value" IN (-1, 1)),
    "created_at"  timestamptz  NOT NULL DEFAULT now(),
    "updated_at"  timestamptz  NOT NULL DEFAULT now(),
    PRIMARY KEY ("variant_id", "user_id")
);

ALTER TABLE "public"."variant_votes" OWNER TO "postgres";
ALTER TABLE "public"."variant_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."variant_votes"
    ALTER COLUMN "user_id" SET DEFAULT auth.uid();


-- 3. Vote-count maintenance trigger ------------------------------------------
-- Mirrors the proposal_votes trigger pattern: INSERT/UPDATE/DELETE maintain
-- both per-direction counters and the net vote_count. Caller-side optimistic
-- updates in the frontend mirror the same arithmetic.

CREATE OR REPLACE FUNCTION "public"."variant_votes_bump"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."value" = 1 THEN
            UPDATE "public"."team_variants"
               SET "upvote_count" = "upvote_count" + 1,
                   "vote_count"   = "vote_count"   + 1
             WHERE "id" = NEW."variant_id";
        ELSE
            UPDATE "public"."team_variants"
               SET "downvote_count" = "downvote_count" + 1,
                   "vote_count"     = "vote_count"     - 1
             WHERE "id" = NEW."variant_id";
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW."value" = 1 THEN
            UPDATE "public"."team_variants"
               SET "upvote_count"   = "upvote_count" + 1,
                   "downvote_count" = GREATEST("downvote_count" - 1, 0),
                   "vote_count"     = "vote_count" + 2
             WHERE "id" = NEW."variant_id";
        ELSE
            UPDATE "public"."team_variants"
               SET "upvote_count"   = GREATEST("upvote_count" - 1, 0),
                   "downvote_count" = "downvote_count" + 1,
                   "vote_count"     = "vote_count" - 2
             WHERE "id" = NEW."variant_id";
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."value" = 1 THEN
            UPDATE "public"."team_variants"
               SET "upvote_count" = GREATEST("upvote_count" - 1, 0),
                   "vote_count"   = "vote_count" - 1
             WHERE "id" = OLD."variant_id";
        ELSE
            UPDATE "public"."team_variants"
               SET "downvote_count" = GREATEST("downvote_count" - 1, 0),
                   "vote_count"     = "vote_count" + 1
             WHERE "id" = OLD."variant_id";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "variant_votes_bump_insert"
    AFTER INSERT ON "public"."variant_votes"
    FOR EACH ROW EXECUTE FUNCTION "public"."variant_votes_bump"();

CREATE TRIGGER "variant_votes_bump_update"
    AFTER UPDATE ON "public"."variant_votes"
    FOR EACH ROW
    WHEN (OLD."value" IS DISTINCT FROM NEW."value")
    EXECUTE FUNCTION "public"."variant_votes_bump"();

CREATE TRIGGER "variant_votes_bump_delete"
    AFTER DELETE ON "public"."variant_votes"
    FOR EACH ROW EXECUTE FUNCTION "public"."variant_votes_bump"();


-- updated_at maintenance for team_variants and variant_votes.
CREATE OR REPLACE FUNCTION "public"."touch_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updated_at" := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "team_variants_touch"
    BEFORE UPDATE ON "public"."team_variants"
    FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();

CREATE TRIGGER "variant_votes_touch"
    BEFORE UPDATE ON "public"."variant_votes"
    FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();


-- 4. Submission RPC ----------------------------------------------------------
-- Single entry point for publishing a team to the public feed. Hashes the
-- team_blob server-side, upserts into team_variants, registers the caller as
-- a contributor. Returns the canonical variant_id + whether the variant was
-- newly created (vs. already existed). Frontend uses is_new to decide between
-- "你已成為這個配置的首位作者" and "此配置已存在，你已加入貢獻者列表".
--
-- SECURITY DEFINER so the function can write team_variants regardless of the
-- caller's grants — but we still gate on auth.uid(), so anon callers are
-- rejected. The function never trusts caller-provided ids; everything is
-- derived from the JWT (user_id) and the hash function (ids).

CREATE OR REPLACE FUNCTION "public"."submit_variant"(p_team jsonb, p_author_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user           uuid := auth.uid();
    v_variant_hash   text;
    v_hero_set_hash  text;
    v_variant_id     uuid;
    v_is_new         boolean := false;
    v_capped_name    text;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'auth required';
    END IF;

    SELECT h.variant_hash, h.hero_set_hash
      INTO v_variant_hash, v_hero_set_hash
      FROM public.compute_variant_hashes(p_team) h;

    -- Defensive: a hash of NULL/empty inputs would still be deterministic but
    -- meaningless — refuse to register a variant with no main hero.
    IF (p_team->'main'->'hero'->>'name') IS NULL THEN
        RAISE EXCEPTION 'main hero required';
    END IF;

    v_capped_name := CASE
        WHEN p_author_name IS NULL THEN NULL
        ELSE left(p_author_name, 10)
    END;

    -- Upsert variant. ON CONFLICT (variant_hash) DO NOTHING returns no row,
    -- so we read it back in the IF NOT FOUND branch.
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

    -- Register caller as contributor. Idempotent.
    INSERT INTO public.variant_contributors (variant_id, user_id, author_name)
    VALUES (v_variant_id, v_user, v_capped_name)
    ON CONFLICT (variant_id, user_id) DO UPDATE
       SET author_name = EXCLUDED.author_name;

    RETURN jsonb_build_object(
        'variant_id',   v_variant_id,
        'variant_hash', v_variant_hash,
        'hero_set_hash', v_hero_set_hash,
        'is_new',       v_is_new
    );
END;
$$;


-- Withdraw the caller's contribution from a variant. If they were the only
-- contributor, the variant is deleted (votes cascade). first_author transfer
-- to the next-oldest contributor when the original first_author leaves.
CREATE OR REPLACE FUNCTION "public"."withdraw_variant"(p_variant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user            uuid := auth.uid();
    v_remaining       int;
    v_new_first       uuid;
    v_was_first       boolean := false;
BEGIN
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'auth required';
    END IF;

    -- Was this user the recorded first_author? If so we'll transfer it
    -- on withdrawal so credit doesn't become NULL while others still
    -- contribute to this variant.
    SELECT (first_author = v_user) INTO v_was_first
      FROM public.team_variants
     WHERE id = p_variant_id;

    DELETE FROM public.variant_contributors
     WHERE variant_id = p_variant_id AND user_id = v_user;

    SELECT count(*) INTO v_remaining
      FROM public.variant_contributors
     WHERE variant_id = p_variant_id;

    IF v_remaining = 0 THEN
        -- No contributors left → variant becomes orphaned. We could keep
        -- the row for vote history, but a publicly listed variant with no
        -- authors is a UX dead-end. Delete it; variant_votes cascade.
        DELETE FROM public.team_variants WHERE id = p_variant_id;
        RETURN jsonb_build_object('deleted', true);
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
    END IF;

    RETURN jsonb_build_object('deleted', false, 'first_author', v_new_first);
END;
$$;


-- 4b. Lookup helper used by the proposal toggle flow. When a user flips a
-- proposal from public→private we need the variant_id to withdraw, but the
-- client never stored it. Computing the hash server-side and looking up the
-- canonical row is simpler than schlepping the id back into the proposal row.
CREATE OR REPLACE FUNCTION "public"."find_variant_for_team"(p_team jsonb)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT id
      FROM public.team_variants
     WHERE variant_hash = (public.compute_variant_hashes(p_team)).variant_hash
     LIMIT 1
$$;


-- 5. Listing helpers ---------------------------------------------------------
-- Aggregated view used by the Level-1 grid. Returns one row per hero_set with
-- a representative variant blob (for portrait extraction), variant count, and
-- both lifetime and 30-day vote sums. The frontend orders by whichever metric
-- the user picked.

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
    WITH ranked AS (
        SELECT
            tv.hero_set_hash,
            tv.id AS variant_id,
            tv.team_blob,
            tv.vote_count,
            tv.upvote_count,
            tv.updated_at,
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
        r.hero_set_hash,
        r.variant_id AS sample_variant_id,
        r.team_blob  AS sample_team_blob,
        (SELECT count(*) FROM public.team_variants WHERE hero_set_hash = r.hero_set_hash) AS variant_count,
        (SELECT COALESCE(sum(vote_count),   0) FROM public.team_variants WHERE hero_set_hash = r.hero_set_hash) AS total_vote_count,
        (SELECT COALESCE(sum(upvote_count), 0) FROM public.team_variants WHERE hero_set_hash = r.hero_set_hash) AS total_upvote_count,
        (SELECT max(updated_at) FROM public.team_variants WHERE hero_set_hash = r.hero_set_hash) AS last_active_at,
        COALESCE(recent.delta, 0) AS recent_vote_delta
    FROM ranked r
    LEFT JOIN recent USING (hero_set_hash)
    WHERE r.rn = 1
    ORDER BY total_vote_count DESC, last_active_at DESC
    LIMIT p_limit OFFSET p_offset;
$$;


-- 6. RLS policies ------------------------------------------------------------

-- team_variants: public read, no direct write (writes via RPCs only).
CREATE POLICY "team_variants_public_select"
    ON "public"."team_variants" FOR SELECT
    USING (true);

-- variant_contributors: public read (needed to show "also by N users").
CREATE POLICY "variant_contributors_public_select"
    ON "public"."variant_contributors" FOR SELECT
    USING (true);

-- variant_votes: own row select, insert, update, delete. Cannot vote on a
-- variant you've authored or contributed to — keep the rule simple at first:
-- cannot vote on a variant where you appear in variant_contributors.
CREATE POLICY "variant_votes_self_select"
    ON "public"."variant_votes" FOR SELECT TO "authenticated"
    USING ("user_id" = "auth"."uid"());

CREATE POLICY "variant_votes_self_insert"
    ON "public"."variant_votes" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = "auth"."uid"()
        AND NOT EXISTS (
            SELECT 1 FROM "public"."variant_contributors" vc
             WHERE vc."variant_id" = "variant_id"
               AND vc."user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "variant_votes_self_update"
    ON "public"."variant_votes" FOR UPDATE TO "authenticated"
    USING ("user_id" = "auth"."uid"())
    WITH CHECK (
        "user_id" = "auth"."uid"()
        AND NOT EXISTS (
            SELECT 1 FROM "public"."variant_contributors" vc
             WHERE vc."variant_id" = "variant_id"
               AND vc."user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "variant_votes_self_delete"
    ON "public"."variant_votes" FOR DELETE TO "authenticated"
    USING ("user_id" = "auth"."uid"());


-- 7. Grants ------------------------------------------------------------------

GRANT SELECT ON "public"."team_variants"        TO "anon", "authenticated";
GRANT SELECT ON "public"."variant_contributors" TO "anon", "authenticated";
GRANT ALL    ON "public"."team_variants"        TO "service_role";
GRANT ALL    ON "public"."variant_contributors" TO "service_role";

GRANT SELECT, INSERT, UPDATE, DELETE
    ON "public"."variant_votes" TO "authenticated";
GRANT ALL ON "public"."variant_votes" TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."variant_role_signature"(jsonb)
    TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."compute_variant_hashes"(jsonb)
    TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."submit_variant"(jsonb, text)
    TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."withdraw_variant"(uuid)
    TO "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."list_hero_sets"(int, int)
    TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."find_variant_for_team"(jsonb)
    TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."variant_votes_bump"()
    TO "anon", "authenticated", "service_role";
GRANT EXECUTE ON FUNCTION "public"."touch_updated_at"()
    TO "anon", "authenticated", "service_role";


-- 8. Backfill from existing public proposals ---------------------------------
-- Group existing public proposals by variant_hash; oldest submitter wins
-- first_author. Every original author becomes a contributor. Per-user votes
-- across multiple proposals collapsing into the same variant keep their most
-- recent vote.

DO $$
DECLARE
    v_proposal record;
    v_hashes   record;
    v_variant_id uuid;
BEGIN
    -- Step A: insert variants (deduped by variant_hash).
    FOR v_proposal IN
        SELECT p.id, p.user_id, p.team_blob, p.created_at, p.author_name
          FROM public.proposals p
         WHERE p.is_public = true
         ORDER BY p.created_at ASC
    LOOP
        SELECT * INTO v_hashes
          FROM public.compute_variant_hashes(v_proposal.team_blob);

        INSERT INTO public.team_variants
            (variant_hash, hero_set_hash, team_blob, first_author, first_submitted_at)
        VALUES
            (v_hashes.variant_hash, v_hashes.hero_set_hash,
             v_proposal.team_blob, v_proposal.user_id, v_proposal.created_at)
        ON CONFLICT (variant_hash) DO NOTHING;

        SELECT id INTO v_variant_id
          FROM public.team_variants
         WHERE variant_hash = v_hashes.variant_hash;

        INSERT INTO public.variant_contributors
            (variant_id, user_id, contributed_at, author_name)
        VALUES
            (v_variant_id, v_proposal.user_id, v_proposal.created_at, v_proposal.author_name)
        ON CONFLICT (variant_id, user_id) DO NOTHING;
    END LOOP;

    -- Step B: carry votes over. If a user voted on multiple proposals that
    -- collapsed into the same variant, keep their newest vote.
    INSERT INTO public.variant_votes (variant_id, user_id, value, created_at)
    SELECT DISTINCT ON (tv.id, pv.user_id)
        tv.id, pv.user_id, pv.value, pv.created_at
      FROM public.proposal_votes pv
      JOIN public.proposals p   ON p.id = pv.proposal_id AND p.is_public = true
      JOIN public.team_variants tv
        ON tv.variant_hash = (public.compute_variant_hashes(p.team_blob)).variant_hash
     ORDER BY tv.id, pv.user_id, pv.created_at DESC
    ON CONFLICT (variant_id, user_id) DO NOTHING;
END $$;
