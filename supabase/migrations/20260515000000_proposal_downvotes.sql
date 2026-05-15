-- 配將提案: extend the existing single-direction upvote system to support
-- downvotes. Design choices:
--
-- 1) Single `proposal_votes` row per (proposal, user), but with a signed
--    `value smallint CHECK (-1, 1)` column rather than two parallel tables.
--    One row makes "switch direction" a single UPDATE — preserves the unique
--    (proposal_id, user_id) PK we already rely on and keeps RLS one-shape.
--
-- 2) `proposals.vote_count` becomes the NET score (upvotes − downvotes) so
--    existing ORDER BY vote_count DESC still ranks correctly. We add
--    `upvote_count`/`downvote_count` for separate display in the UI.
--
-- 3) The trigger now handles INSERT/UPDATE/DELETE. UPDATE fires only when
--    `value` flips, applying a +2/-2 net swing and adjusting both per-direction
--    counters.
--
-- 4) Existing rows are all upvotes (the only kind that could exist), so the
--    backfill seeds upvote_count from vote_count and leaves downvote_count at 0.

-- 1. Direction column on the join table -------------------------------
ALTER TABLE "public"."proposal_votes"
    ADD COLUMN "value" smallint NOT NULL DEFAULT 1
    CHECK ("value" IN (-1, 1));


-- 2. Per-direction counters on proposals ------------------------------
ALTER TABLE "public"."proposals"
    ADD COLUMN "upvote_count"   integer NOT NULL DEFAULT 0,
    ADD COLUMN "downvote_count" integer NOT NULL DEFAULT 0;

-- Backfill: every pre-existing row in proposal_votes is an upvote, so
-- vote_count already equals upvote_count for every proposal.
UPDATE "public"."proposals" SET "upvote_count" = "vote_count";


-- 3. Updated trigger function -----------------------------------------
-- Replaces the previous body which only knew upvotes. The net `vote_count`
-- is no longer clamped at 0 — downvotes can legitimately push it negative.
-- The per-direction counters keep the GREATEST(.., 0) guard so they never
-- go below zero in the face of a stale-cache edit.
CREATE OR REPLACE FUNCTION "public"."proposal_votes_bump"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- New UPDATE trigger to react to direction flips. The existing INSERT/DELETE
-- triggers remain — they call the same (now richer) function.
CREATE TRIGGER "proposal_votes_bump_update"
    AFTER UPDATE ON "public"."proposal_votes"
    FOR EACH ROW
    WHEN (OLD."value" IS DISTINCT FROM NEW."value")
    EXECUTE FUNCTION "public"."proposal_votes_bump"();


-- 4. Allow users to UPDATE their own vote row (for direction flips) ---
-- The proposal-existence guard also excludes self-voting (see step 5).
CREATE POLICY "proposal_votes_self_update"
    ON "public"."proposal_votes" FOR UPDATE TO "authenticated"
    USING ("user_id" = "auth"."uid"())
    WITH CHECK (
        "user_id" = "auth"."uid"()
        AND EXISTS (
            SELECT 1 FROM "public"."proposals" p
             WHERE p."id" = "proposal_id"
               AND p."is_public" = true
               AND p."user_id" <> "auth"."uid"()
        )
    );

GRANT UPDATE ON "public"."proposal_votes" TO "authenticated";


-- 5. Close the self-vote loophole on INSERT --------------------------
-- The original INSERT policy (from 20260509…_proposals.sql) lets a user vote
-- on their own private or public proposal. The UI guards against this, but
-- a determined client could POST directly to inflate their own score.
-- Replace the policy so the DB also enforces "no voting on your own row".
DROP POLICY IF EXISTS "proposal_votes_self_insert" ON "public"."proposal_votes";
CREATE POLICY "proposal_votes_self_insert"
    ON "public"."proposal_votes" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = "auth"."uid"()
        AND EXISTS (
            SELECT 1 FROM "public"."proposals" p
             WHERE p."id" = "proposal_id"
               AND p."is_public" = true
               AND p."user_id" <> "auth"."uid"()
        )
    );
