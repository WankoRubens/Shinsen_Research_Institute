


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."compute_variant_hashes"("p_team" "jsonb", OUT "variant_hash" "text", OUT "hero_set_hash" "text") RETURNS "record"
    LANGUAGE "plpgsql" IMMUTABLE
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


ALTER FUNCTION "public"."compute_variant_hashes"("p_team" "jsonb", OUT "variant_hash" "text", OUT "hero_set_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_variant_for_team"("p_team" "jsonb") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
    SELECT id
      FROM public.team_variants
     WHERE variant_hash = (public.compute_variant_hashes(p_team)).variant_hash
     LIMIT 1
$$;


ALTER FUNCTION "public"."find_variant_for_team"("p_team" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_hero_sets"("p_limit" integer DEFAULT 60, "p_offset" integer DEFAULT 0) RETURNS TABLE("hero_set_hash" "text", "sample_variant_id" "uuid", "sample_team_blob" "jsonb", "variant_count" bigint, "total_vote_count" bigint, "total_upvote_count" bigint, "last_active_at" timestamp with time zone, "recent_vote_delta" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."list_hero_sets"("p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."proposal_votes_bump"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."value" = 1 THEN
            UPDATE "public"."proposals"
               SET "upvote_count" = "upvote_count" + 1,
                   "vote_count"   = "vote_count"   + 1
             WHERE "id" = NEW."proposal_id";
        ELSE
            UPDATE "public"."proposals"
               SET "downvote_count" = "downvote_count" + 1,
                   "vote_count"     = "vote_count"     - 1
             WHERE "id" = NEW."proposal_id";
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- The trigger's WHEN clause pre-filters to rows where value flipped,
        -- so this branch only runs when OLD.value <> NEW.value.
        IF NEW."value" = 1 THEN
            -- flipped -1 → 1: +1 to upvote, -1 to downvote, +2 to net
            UPDATE "public"."proposals"
               SET "upvote_count"   = "upvote_count" + 1,
                   "downvote_count" = GREATEST("downvote_count" - 1, 0),
                   "vote_count"     = "vote_count" + 2
             WHERE "id" = NEW."proposal_id";
        ELSE
            -- flipped 1 → -1: -1 to upvote, +1 to downvote, -2 to net
            UPDATE "public"."proposals"
               SET "upvote_count"   = GREATEST("upvote_count" - 1, 0),
                   "downvote_count" = "downvote_count" + 1,
                   "vote_count"     = "vote_count" - 2
             WHERE "id" = NEW."proposal_id";
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        IF OLD."value" = 1 THEN
            UPDATE "public"."proposals"
               SET "upvote_count" = GREATEST("upvote_count" - 1, 0),
                   "vote_count"   = "vote_count" - 1
             WHERE "id" = OLD."proposal_id";
        ELSE
            UPDATE "public"."proposals"
               SET "downvote_count" = GREATEST("downvote_count" - 1, 0),
                   "vote_count"     = "vote_count" + 1
             WHERE "id" = OLD."proposal_id";
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."proposal_votes_bump"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_variant"("p_team" "jsonb", "p_author_name" "text" DEFAULT NULL::"text", "p_proposal_name" "text" DEFAULT NULL::"text", "p_proposal_comment" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user           uuid := auth.uid();
    v_variant_hash   text;
    v_hero_set_hash  text;
    v_variant_id     uuid;
    v_is_new         boolean := false;
    v_capped_name             text;
    v_capped_proposal_name    text;
    v_capped_proposal_comment text;
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
    v_capped_proposal_name := CASE
        WHEN NULLIF(btrim(p_proposal_name), '') IS NULL THEN NULL
        ELSE left(btrim(p_proposal_name), 50)
    END;
    v_capped_proposal_comment := CASE
        WHEN NULLIF(btrim(p_proposal_comment), '') IS NULL THEN NULL
        ELSE left(btrim(p_proposal_comment), 500)
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
    INSERT INTO public.variant_contributors
        (variant_id, user_id, author_name, proposal_name, proposal_comment)
    VALUES
        (v_variant_id, v_user, v_capped_name, v_capped_proposal_name, v_capped_proposal_comment)
    ON CONFLICT (variant_id, user_id) DO UPDATE
       SET author_name = EXCLUDED.author_name,
           proposal_name = EXCLUDED.proposal_name,
           proposal_comment = EXCLUDED.proposal_comment;

    RETURN jsonb_build_object(
        'variant_id',   v_variant_id,
        'variant_hash', v_variant_hash,
        'hero_set_hash', v_hero_set_hash,
        'is_new',       v_is_new
    );
END;
$$;


ALTER FUNCTION "public"."submit_variant"("p_team" "jsonb", "p_author_name" "text", "p_proposal_name" "text", "p_proposal_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW."updated_at" := now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."variant_role_signature"("role" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
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


ALTER FUNCTION "public"."variant_role_signature"("role" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."variant_votes_bump"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."variant_votes_bump"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."withdraw_variant"("p_variant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."withdraw_variant"("p_variant_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."character_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "inv_h" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "inv_s" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."character_profiles" OWNER TO "postgres";










CREATE TABLE IF NOT EXISTS "public"."lineup_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "teams" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "team_schema" integer DEFAULT 4 NOT NULL,
    "client_id" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_id_length" CHECK ((("client_id" IS NULL) OR ("char_length"("client_id") <= 64))),
    CONSTRAINT "name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 80))),
    CONSTRAINT "teams_count_limit" CHECK ((("jsonb_typeof"("teams") = 'array'::"text") AND ("jsonb_array_length"("teams") <= 10))),
    CONSTRAINT "teams_size_limit" CHECK (("octet_length"(("teams")::"text") < 200000))
);


ALTER TABLE "public"."lineup_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposal_votes" (
    "proposal_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "value" smallint DEFAULT 1 NOT NULL,
    CONSTRAINT "proposal_votes_value_check" CHECK (("value" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."proposal_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proposals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "team_blob" "jsonb" NOT NULL,
    "team_schema" integer DEFAULT 1 NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "author_name" "text",
    "vote_count" integer DEFAULT 0 NOT NULL,
    "forked_from" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "upvote_count" integer DEFAULT 0 NOT NULL,
    "downvote_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "description_length" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 500))),
    CONSTRAINT "name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 80))),
    CONSTRAINT "team_blob_size_limit" CHECK (("octet_length"(("team_blob")::"text") < 50000))
);


ALTER TABLE "public"."proposals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shares" (
    "slug" "text" NOT NULL,
    "blob" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "display_name" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pinned" boolean DEFAULT false NOT NULL,
    "kind" "text" DEFAULT 'lineup'::"text" NOT NULL,
    CONSTRAINT "blob_size_limit" CHECK (("octet_length"(("blob")::"text") < 100000)),
    CONSTRAINT "shares_kind_check" CHECK (("kind" = ANY (ARRAY['lineup'::"text", 'group'::"text", 'inventory'::"text", 'profile'::"text"])))
);


ALTER TABLE "public"."shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "variant_hash" "text" NOT NULL,
    "hero_set_hash" "text" NOT NULL,
    "team_blob" "jsonb" NOT NULL,
    "team_schema" integer DEFAULT 1 NOT NULL,
    "first_author" "uuid",
    "first_submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vote_count" integer DEFAULT 0 NOT NULL,
    "upvote_count" integer DEFAULT 0 NOT NULL,
    "downvote_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "variant_blob_size_limit" CHECK (("octet_length"(("team_blob")::"text") < 50000))
);


ALTER TABLE "public"."team_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."variant_contributors" (
    "variant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contributed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "author_name" "text",
    "proposal_name" "text",
    "proposal_comment" "text",
    CONSTRAINT "variant_contributors_proposal_comment_length" CHECK (("proposal_comment" IS NULL OR "char_length"("proposal_comment") <= 500)),
    CONSTRAINT "variant_contributors_proposal_name_length" CHECK (("proposal_name" IS NULL OR "char_length"("proposal_name") <= 50))
);


ALTER TABLE "public"."variant_contributors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."variant_votes" (
    "variant_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "value" smallint DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "variant_votes_value_check" CHECK (("value" = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE "public"."variant_votes" OWNER TO "postgres";




ALTER TABLE ONLY "public"."character_profiles"
    ADD CONSTRAINT "character_profiles_pkey" PRIMARY KEY ("id");







ALTER TABLE ONLY "public"."lineup_groups"
    ADD CONSTRAINT "lineup_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proposal_votes"
    ADD CONSTRAINT "proposal_votes_pkey" PRIMARY KEY ("proposal_id", "user_id");



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shares"
    ADD CONSTRAINT "shares_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."team_variants"
    ADD CONSTRAINT "team_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_variants"
    ADD CONSTRAINT "team_variants_variant_hash_key" UNIQUE ("variant_hash");



ALTER TABLE ONLY "public"."variant_contributors"
    ADD CONSTRAINT "variant_contributors_pkey" PRIMARY KEY ("variant_id", "user_id");



ALTER TABLE ONLY "public"."variant_votes"
    ADD CONSTRAINT "variant_votes_pkey" PRIMARY KEY ("variant_id", "user_id");



CREATE INDEX "character_profiles_user_id_idx" ON "public"."character_profiles" USING "btree" ("user_id");







CREATE UNIQUE INDEX "lineup_groups_user_client_uniq" ON "public"."lineup_groups" USING "btree" ("user_id", "client_id") WHERE ("client_id" IS NOT NULL);



CREATE INDEX "lineup_groups_user_idx" ON "public"."lineup_groups" USING "btree" ("user_id", "sort_order", "updated_at" DESC);



CREATE INDEX "proposals_forked_from_idx" ON "public"."proposals" USING "btree" ("forked_from") WHERE ("forked_from" IS NOT NULL);



CREATE INDEX "proposals_public_idx" ON "public"."proposals" USING "btree" ("is_public", "vote_count" DESC, "updated_at" DESC) WHERE ("is_public" = true);



CREATE INDEX "proposals_user_idx" ON "public"."proposals" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "shares_created_at_idx" ON "public"."shares" USING "btree" ("created_at");



CREATE INDEX "shares_kind_idx" ON "public"."shares" USING "btree" ("kind");



CREATE INDEX "shares_user_id_idx" ON "public"."shares" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "team_variants_hero_set_idx" ON "public"."team_variants" USING "btree" ("hero_set_hash", "vote_count" DESC, "updated_at" DESC);



CREATE INDEX "team_variants_score_idx" ON "public"."team_variants" USING "btree" ("vote_count" DESC, "updated_at" DESC);



CREATE INDEX "variant_contributors_user_idx" ON "public"."variant_contributors" USING "btree" ("user_id", "contributed_at" DESC);



CREATE OR REPLACE TRIGGER "lineup_groups_set_updated_at" BEFORE UPDATE ON "public"."lineup_groups" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "proposal_votes_bump_delete" AFTER DELETE ON "public"."proposal_votes" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_votes_bump"();



CREATE OR REPLACE TRIGGER "proposal_votes_bump_insert" AFTER INSERT ON "public"."proposal_votes" FOR EACH ROW EXECUTE FUNCTION "public"."proposal_votes_bump"();



CREATE OR REPLACE TRIGGER "proposal_votes_bump_update" AFTER UPDATE ON "public"."proposal_votes" FOR EACH ROW WHEN (("old"."value" IS DISTINCT FROM "new"."value")) EXECUTE FUNCTION "public"."proposal_votes_bump"();



CREATE OR REPLACE TRIGGER "proposals_set_updated_at" BEFORE UPDATE ON "public"."proposals" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "team_variants_touch" BEFORE UPDATE ON "public"."team_variants" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "variant_votes_bump_delete" AFTER DELETE ON "public"."variant_votes" FOR EACH ROW EXECUTE FUNCTION "public"."variant_votes_bump"();



CREATE OR REPLACE TRIGGER "variant_votes_bump_insert" AFTER INSERT ON "public"."variant_votes" FOR EACH ROW EXECUTE FUNCTION "public"."variant_votes_bump"();



CREATE OR REPLACE TRIGGER "variant_votes_bump_update" AFTER UPDATE ON "public"."variant_votes" FOR EACH ROW WHEN (("old"."value" IS DISTINCT FROM "new"."value")) EXECUTE FUNCTION "public"."variant_votes_bump"();



CREATE OR REPLACE TRIGGER "variant_votes_touch" BEFORE UPDATE ON "public"."variant_votes" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."character_profiles"
    ADD CONSTRAINT "character_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;









ALTER TABLE ONLY "public"."lineup_groups"
    ADD CONSTRAINT "lineup_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_votes"
    ADD CONSTRAINT "proposal_votes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposal_votes"
    ADD CONSTRAINT "proposal_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_forked_from_fkey" FOREIGN KEY ("forked_from") REFERENCES "public"."proposals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."proposals"
    ADD CONSTRAINT "proposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shares"
    ADD CONSTRAINT "shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_variants"
    ADD CONSTRAINT "team_variants_first_author_fkey" FOREIGN KEY ("first_author") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."variant_contributors"
    ADD CONSTRAINT "variant_contributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_contributors"
    ADD CONSTRAINT "variant_contributors_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."team_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_votes"
    ADD CONSTRAINT "variant_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variant_votes"
    ADD CONSTRAINT "variant_votes_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."team_variants"("id") ON DELETE CASCADE;



ALTER TABLE "public"."character_profiles" ENABLE ROW LEVEL SECURITY;




















ALTER TABLE "public"."lineup_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lineup_groups_owner_delete" ON "public"."lineup_groups" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "lineup_groups_owner_insert" ON "public"."lineup_groups" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "lineup_groups_owner_select" ON "public"."lineup_groups" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "lineup_groups_owner_update" ON "public"."lineup_groups" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "profiles_owner_delete" ON "public"."character_profiles" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_owner_insert" ON "public"."character_profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_owner_select" ON "public"."character_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "profiles_owner_update" ON "public"."character_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."proposal_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposal_votes_self_delete" ON "public"."proposal_votes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "proposal_votes_self_insert" ON "public"."proposal_votes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."proposals" "p"
  WHERE (("p"."id" = "proposal_votes"."proposal_id") AND ("p"."is_public" = true) AND ("p"."user_id" <> "auth"."uid"()))))));



CREATE POLICY "proposal_votes_self_select" ON "public"."proposal_votes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "proposal_votes_self_update" ON "public"."proposal_votes" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."proposals" "p"
  WHERE (("p"."id" = "proposal_votes"."proposal_id") AND ("p"."is_public" = true) AND ("p"."user_id" <> "auth"."uid"()))))));



ALTER TABLE "public"."proposals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "proposals_owner_delete" ON "public"."proposals" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "proposals_owner_insert" ON "public"."proposals" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "proposals_owner_select" ON "public"."proposals" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "proposals_owner_update" ON "public"."proposals" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "proposals_public_select" ON "public"."proposals" FOR SELECT USING (("is_public" = true));



ALTER TABLE "public"."shares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shares_anon_insert" ON "public"."shares" FOR INSERT TO "anon" WITH CHECK (("user_id" IS NULL));



CREATE POLICY "shares_auth_insert" ON "public"."shares" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



CREATE POLICY "shares_owner_delete" ON "public"."shares" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "shares_owner_update" ON "public"."shares" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "shares_public_select" ON "public"."shares" FOR SELECT USING (true);



ALTER TABLE "public"."team_variants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_variants_public_select" ON "public"."team_variants" FOR SELECT USING (true);



ALTER TABLE "public"."variant_contributors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "variant_contributors_public_select" ON "public"."variant_contributors" FOR SELECT USING (true);



ALTER TABLE "public"."variant_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "variant_votes_self_delete" ON "public"."variant_votes" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "variant_votes_self_insert" ON "public"."variant_votes" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (NOT ("variant_id" IN ( SELECT "variant_contributors"."variant_id"
   FROM "public"."variant_contributors"
  WHERE ("variant_contributors"."user_id" = "auth"."uid"()))))));



CREATE POLICY "variant_votes_self_select" ON "public"."variant_votes" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "variant_votes_self_update" ON "public"."variant_votes" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND (NOT ("variant_id" IN ( SELECT "variant_contributors"."variant_id"
   FROM "public"."variant_contributors"
  WHERE ("variant_contributors"."user_id" = "auth"."uid"()))))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_variant_hashes"("p_team" "jsonb", OUT "variant_hash" "text", OUT "hero_set_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_variant_hashes"("p_team" "jsonb", OUT "variant_hash" "text", OUT "hero_set_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_variant_hashes"("p_team" "jsonb", OUT "variant_hash" "text", OUT "hero_set_hash" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_variant_for_team"("p_team" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."find_variant_for_team"("p_team" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_variant_for_team"("p_team" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_hero_sets"("p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."list_hero_sets"("p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_hero_sets"("p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."proposal_votes_bump"() TO "anon";
GRANT ALL ON FUNCTION "public"."proposal_votes_bump"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."proposal_votes_bump"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_variant"("p_team" "jsonb", "p_author_name" "text", "p_proposal_name" "text", "p_proposal_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_variant"("p_team" "jsonb", "p_author_name" "text", "p_proposal_name" "text", "p_proposal_comment" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."variant_role_signature"("role" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."variant_role_signature"("role" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."variant_role_signature"("role" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."variant_votes_bump"() TO "anon";
GRANT ALL ON FUNCTION "public"."variant_votes_bump"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."variant_votes_bump"() TO "service_role";



GRANT ALL ON FUNCTION "public"."withdraw_variant"("p_variant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."withdraw_variant"("p_variant_id" "uuid") TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."character_profiles" TO "anon";
GRANT ALL ON TABLE "public"."character_profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."character_profiles" TO "service_role";












GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."lineup_groups" TO "anon";
GRANT ALL ON TABLE "public"."lineup_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."lineup_groups" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."proposal_votes" TO "anon";
GRANT ALL ON TABLE "public"."proposal_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."proposal_votes" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."proposals" TO "anon";
GRANT ALL ON TABLE "public"."proposals" TO "authenticated";
GRANT ALL ON TABLE "public"."proposals" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shares" TO "anon";
GRANT ALL ON TABLE "public"."shares" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shares" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."team_variants" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."team_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."team_variants" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."variant_contributors" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."variant_contributors" TO "authenticated";
GRANT ALL ON TABLE "public"."variant_contributors" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."variant_votes" TO "anon";
GRANT ALL ON TABLE "public"."variant_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."variant_votes" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";







