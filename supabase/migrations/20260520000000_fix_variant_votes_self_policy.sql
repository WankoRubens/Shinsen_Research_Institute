-- Fix RLS bug in variant_votes_self_insert / variant_votes_self_update.
--
-- The original policies (20260518000000_team_variants.sql) wrote:
--
--   WHERE vc.variant_id = "variant_id"
--
-- The intent was to block users from voting on variants they've contributed
-- to. But PG's name resolution picks the nearest scope: bare "variant_id"
-- inside the EXISTS subquery binds to vc.variant_id (the subquery's own
-- relation) rather than the outer RLS row. The predicate reduces to
-- `vc.variant_id = vc.variant_id` — always true. Effect: any user who has
-- ever contributed to ANY variant is blocked from voting on every variant.
--
-- Earlier fix attempts that DIDN'T work:
--   - "variant_votes"."variant_id"   — qualifier silently re-resolved to vc
--   - (SELECT variant_id)            — empty-FROM SELECT still inherits vc
--
-- Both fail because anywhere inside the EXISTS subquery, the bare column
-- name resolves down to vc before reaching the RLS row scope.
--
-- Fix: rewrite as NOT IN. The outer "variant_id" sits BEFORE the subquery,
-- so the parser only sees the RLS row at that position — no inner relation
-- can shadow it. variant_contributors.variant_id is NOT NULL (FK + PK), so
-- NOT IN's NULL semantics are not a concern here.

DROP POLICY IF EXISTS "variant_votes_self_insert" ON "public"."variant_votes";
DROP POLICY IF EXISTS "variant_votes_self_update" ON "public"."variant_votes";

CREATE POLICY "variant_votes_self_insert"
    ON "public"."variant_votes" FOR INSERT TO "authenticated"
    WITH CHECK (
        "user_id" = "auth"."uid"()
        AND "variant_id" NOT IN (
            SELECT "variant_id" FROM "public"."variant_contributors"
             WHERE "user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "variant_votes_self_update"
    ON "public"."variant_votes" FOR UPDATE TO "authenticated"
    USING ("user_id" = "auth"."uid"())
    WITH CHECK (
        "user_id" = "auth"."uid"()
        AND "variant_id" NOT IN (
            SELECT "variant_id" FROM "public"."variant_contributors"
             WHERE "user_id" = "auth"."uid"()
        )
    );
