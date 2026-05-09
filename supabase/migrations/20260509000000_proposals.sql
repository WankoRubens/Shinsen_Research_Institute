-- 配將提案 (Proposal) feature: per-team shareable lineup snapshots with
-- community voting. Companion to the existing shares table — shares are
-- whole-app blobs (lineups + inventory), proposals are single-team
-- snapshots that are first-class citizens with a public feed.
--
-- Tables:
--   - proposals          one row per proposal; team_blob holds the snapshot
--   - proposal_votes     join table: (user_id, proposal_id) — one vote each
--
-- vote_count on proposals is denormalized for cheap browse-feed reads;
-- maintained by AFTER INSERT/DELETE triggers on proposal_votes.
--
-- Visibility model:
--   is_public = false (default): only the owner can SELECT
--   is_public = true            : anyone (incl. anon) can SELECT

CREATE TABLE IF NOT EXISTS "public"."proposals" (
    "id"           uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"      uuid              NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "name"         text              NOT NULL,
    "description"  text,
    -- Snapshot of the team. Same shape as a single Lineup serialized for share
    -- (hero name + skills + stats + traits + breakthrough + bingxue), plus
    -- enough inline metadata that pipeline renames don't drift the proposal.
    "team_blob"    jsonb             NOT NULL,
    -- Schema version for team_blob. Bump in tandem with a backfill function
    -- when the Lineup TS shape changes incompatibly. rowToProposal() in
    -- src/lib/proposals.ts can branch on this if/when v2 lands.
    "team_schema"  integer           NOT NULL DEFAULT 1,
    "is_public"    boolean           NOT NULL DEFAULT false,
    "author_name"  text,
    "vote_count"   integer           NOT NULL DEFAULT 0,
    "forked_from"  uuid              REFERENCES "public"."proposals"("id") ON DELETE SET NULL,
    "created_at"   timestamptz       NOT NULL DEFAULT now(),
    "updated_at"   timestamptz       NOT NULL DEFAULT now(),
    -- Same blob size guard pattern as shares.
    CONSTRAINT "team_blob_size_limit" CHECK (octet_length(team_blob::text) < 50000),
    CONSTRAINT "name_length"          CHECK (char_length(name) BETWEEN 1 AND 80),
    CONSTRAINT "description_length"   CHECK (description IS NULL OR char_length(description) <= 500)
);

ALTER TABLE "public"."proposals" OWNER TO "postgres";
ALTER TABLE "public"."proposals" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "proposals_public_idx"
    ON "public"."proposals" ("is_public", "vote_count" DESC, "updated_at" DESC)
    WHERE "is_public" = true;

CREATE INDEX IF NOT EXISTS "proposals_user_idx"
    ON "public"."proposals" ("user_id", "updated_at" DESC);

-- Owner full access to own rows.
CREATE POLICY "proposals_owner_select"
    ON "public"."proposals" FOR SELECT TO "authenticated"
    USING ("user_id" = "auth"."uid"());

CREATE POLICY "proposals_owner_insert"
    ON "public"."proposals" FOR INSERT TO "authenticated"
    WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "proposals_owner_update"
    ON "public"."proposals" FOR UPDATE TO "authenticated"
    USING ("user_id" = "auth"."uid"())
    WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "proposals_owner_delete"
    ON "public"."proposals" FOR DELETE TO "authenticated"
    USING ("user_id" = "auth"."uid"());

-- Public visibility: anyone (anon or authenticated) can SELECT public rows.
CREATE POLICY "proposals_public_select"
    ON "public"."proposals" FOR SELECT
    USING ("is_public" = true);


-- Votes ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."proposal_votes" (
    "proposal_id"  uuid           NOT NULL REFERENCES "public"."proposals"("id") ON DELETE CASCADE,
    "user_id"      uuid           NOT NULL REFERENCES "auth"."users"("id")     ON DELETE CASCADE,
    "created_at"   timestamptz    NOT NULL DEFAULT now(),
    PRIMARY KEY ("proposal_id", "user_id")
);

ALTER TABLE "public"."proposal_votes" OWNER TO "postgres";
ALTER TABLE "public"."proposal_votes" ENABLE ROW LEVEL SECURITY;

-- Default user_id to auth.uid() so clients can POST without sending it.
ALTER TABLE "public"."proposal_votes"
    ALTER COLUMN "user_id" SET DEFAULT auth.uid();

CREATE POLICY "proposal_votes_self_select"
    ON "public"."proposal_votes" FOR SELECT TO "authenticated"
    USING ("user_id" = "auth"."uid"());

-- Insert: only authenticated users; user_id must equal their own uid.
-- Additional guard: cannot vote on a private proposal you don't own (RLS on
-- proposals already handles this read-side; here we double-check write-side).
CREATE POLICY "proposal_votes_self_insert"
    ON "public"."proposal_votes" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = "auth"."uid"()
        AND EXISTS (
            SELECT 1 FROM "public"."proposals" p
             WHERE p."id" = "proposal_id"
               AND (p."is_public" = true OR p."user_id" = "auth"."uid"())
        )
    );

CREATE POLICY "proposal_votes_self_delete"
    ON "public"."proposal_votes" FOR DELETE TO "authenticated"
    USING ("user_id" = "auth"."uid"());


-- Vote count maintenance ----------------------------------------------
CREATE OR REPLACE FUNCTION "public"."proposal_votes_bump"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE "public"."proposals"
           SET "vote_count" = "vote_count" + 1
         WHERE "id" = NEW."proposal_id";
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE "public"."proposals"
           SET "vote_count" = GREATEST("vote_count" - 1, 0)
         WHERE "id" = OLD."proposal_id";
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER "proposal_votes_bump_insert"
    AFTER INSERT ON "public"."proposal_votes"
    FOR EACH ROW EXECUTE FUNCTION "public"."proposal_votes_bump"();

CREATE TRIGGER "proposal_votes_bump_delete"
    AFTER DELETE ON "public"."proposal_votes"
    FOR EACH ROW EXECUTE FUNCTION "public"."proposal_votes_bump"();


-- updated_at maintenance ---------------------------------------------
-- No SECURITY DEFINER (vs. proposal_votes_bump): this function only mutates
-- NEW in a BEFORE trigger; the eventual UPDATE statement runs with the
-- caller's privileges, which RLS already restricts to row owners.
CREATE OR REPLACE FUNCTION "public"."proposals_set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updated_at" := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER "proposals_set_updated_at"
    BEFORE UPDATE ON "public"."proposals"
    FOR EACH ROW EXECUTE FUNCTION "public"."proposals_set_updated_at"();


-- Grants ---------------------------------------------------------------
GRANT SELECT                ON "public"."proposals"      TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE
                            ON "public"."proposals"      TO "authenticated";
GRANT ALL                   ON "public"."proposals"      TO "service_role";
GRANT SELECT, INSERT, DELETE
                            ON "public"."proposal_votes" TO "authenticated";
GRANT ALL                   ON "public"."proposal_votes" TO "service_role";
GRANT ALL ON FUNCTION "public"."proposal_votes_bump"()      TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."proposals_set_updated_at"() TO "anon", "authenticated", "service_role";
