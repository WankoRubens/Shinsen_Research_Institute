-- Schema cleanup:
-- 1. Consolidate three identical updated_at trigger functions into one.
-- 2. Add missing supporting index on proposals.forked_from (self-FK).

-- 1. lineup_groups_set_updated_at() and proposals_set_updated_at() are byte-
--    for-byte copies of touch_updated_at(). Retarget their triggers to the
--    canonical function, then drop the redundant copies.

CREATE OR REPLACE TRIGGER "lineup_groups_set_updated_at"
    BEFORE UPDATE ON "public"."lineup_groups"
    FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();

CREATE OR REPLACE TRIGGER "proposals_set_updated_at"
    BEFORE UPDATE ON "public"."proposals"
    FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();

DROP FUNCTION IF EXISTS "public"."lineup_groups_set_updated_at"();
DROP FUNCTION IF EXISTS "public"."proposals_set_updated_at"();

-- 2. proposals.forked_from references proposals.id (self-FK with ON DELETE
--    SET NULL). Without a supporting index, deleting a parent proposal
--    forces a seq scan of proposals to locate children. Partial index since
--    most rows are top-level (forked_from IS NULL).

CREATE INDEX IF NOT EXISTS "proposals_forked_from_idx"
    ON "public"."proposals"("forked_from")
    WHERE "forked_from" IS NOT NULL;
