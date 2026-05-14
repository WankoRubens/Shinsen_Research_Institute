-- 編組 cloud sync. Mirrors the localStorage-backed groups (Phase A in
-- src/composables/useGroupPersistence.ts) into Supabase so a signed-in user
-- gets cross-device persistence. Local storage stays the source of truth
-- per-session; this table is the cross-device mirror.
--
-- Shape: one row per group, teams as jsonb (same shape as
-- ShareableData.groups[].teams — see src/constants/gameData.ts). We do not
-- normalize teams into a child table: teams aren't queryable units, they
-- are a whole-group snapshot, and normalizing would force a JOIN on every
-- read for zero downstream benefit.
--
-- Conflict detection: PATCH calls send the updated_at the client last
-- observed via a `&updated_at=eq.<iso>` filter + Prefer: return=representation.
-- A 0-row response signals that another device updated the row first;
-- the client surfaces a "your other device has newer changes" conflict
-- dialog rather than silently overwriting.
--
-- client_id: per-group stable identifier emitted by the local autosave
-- (ShareableGroup.id, see useGroupPersistence buildBlob). Used for idempotent
-- upsert on first sign-in so a network blip mid-create can't duplicate. May
-- be NULL for rows created cloud-first from a second device with no local
-- snapshot — the partial unique index handles both cases.

CREATE TABLE IF NOT EXISTS "public"."lineup_groups" (
    "id"           uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"      uuid              NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "name"         text              NOT NULL,
    "teams"        jsonb             NOT NULL DEFAULT '[]'::jsonb,
    -- Schema version for teams. Bump in tandem with a backfill when the
    -- ShareableLineup shape changes incompatibly. Matches proposals.team_schema's
    -- versioning pattern; current frontend writes shape v4.
    "team_schema"  integer           NOT NULL DEFAULT 4,
    "client_id"    text,
    "sort_order"   integer           NOT NULL DEFAULT 0,
    "created_at"   timestamptz       NOT NULL DEFAULT now(),
    "updated_at"   timestamptz       NOT NULL DEFAULT now(),
    -- Size cap. 10 teams × ~3KB measured average ≈ 30KB; 200KB ceiling gives
    -- comfortable headroom for outliers (full bingxue + dense stat overrides).
    CONSTRAINT "teams_size_limit"   CHECK (octet_length("teams"::text) < 200000),
    -- jsonb_typeof guard short-circuits jsonb_array_length on non-array input
    -- (which would error). MAX_TEAMS_PER_GROUP in src/types/group.ts is 10.
    CONSTRAINT "teams_count_limit"  CHECK (
        jsonb_typeof("teams") = 'array' AND jsonb_array_length("teams") <= 10
    ),
    CONSTRAINT "name_length"        CHECK (char_length("name") BETWEEN 1 AND 80),
    CONSTRAINT "client_id_length"   CHECK ("client_id" IS NULL OR char_length("client_id") <= 64)
);

ALTER TABLE "public"."lineup_groups" OWNER TO "postgres";
ALTER TABLE "public"."lineup_groups" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "lineup_groups_user_idx"
    ON "public"."lineup_groups" ("user_id", "sort_order", "updated_at" DESC);

-- Partial unique on (user_id, client_id) so a first-sign-in INSERT that
-- retries after a network blip lands on the existing row instead of
-- duplicating. Partial because client_id is nullable — cloud-first rows
-- (from a device that never had a local snapshot to seed it) should not
-- collide.
CREATE UNIQUE INDEX IF NOT EXISTS "lineup_groups_user_client_uniq"
    ON "public"."lineup_groups" ("user_id", "client_id")
    WHERE "client_id" IS NOT NULL;


-- RLS policies — mirror character_profiles exactly (owner-only, no anon).
CREATE POLICY "lineup_groups_owner_select"
    ON "public"."lineup_groups" FOR SELECT TO "authenticated"
    USING ("user_id" = "auth"."uid"());

CREATE POLICY "lineup_groups_owner_insert"
    ON "public"."lineup_groups" FOR INSERT TO "authenticated"
    WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "lineup_groups_owner_update"
    ON "public"."lineup_groups" FOR UPDATE TO "authenticated"
    USING ("user_id" = "auth"."uid"())
    WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "lineup_groups_owner_delete"
    ON "public"."lineup_groups" FOR DELETE TO "authenticated"
    USING ("user_id" = "auth"."uid"());


-- updated_at maintenance — mirrors proposals_set_updated_at. BEFORE trigger
-- so the value is set in the row PostgREST returns to the client, giving the
-- conflict detector its fresh etag-equivalent without a separate SELECT.
CREATE OR REPLACE FUNCTION "public"."lineup_groups_set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updated_at" := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "lineup_groups_set_updated_at"
    BEFORE UPDATE ON "public"."lineup_groups"
    FOR EACH ROW EXECUTE FUNCTION "public"."lineup_groups_set_updated_at"();


-- Grants — same shape as character_profiles. anon gets the maintenance
-- privileges only (Postgres requires REFERENCES etc. to be granted somewhere
-- for the FK to work); SELECT/INSERT/UPDATE/DELETE are gated by RLS to the
-- owner role only.
GRANT REFERENCES, TRIGGER, TRUNCATE, MAINTAIN ON TABLE "public"."lineup_groups" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE          ON TABLE "public"."lineup_groups" TO "authenticated";
GRANT ALL                                     ON TABLE "public"."lineup_groups" TO "service_role";

GRANT ALL ON FUNCTION "public"."lineup_groups_set_updated_at"()
    TO "anon", "authenticated", "service_role";
