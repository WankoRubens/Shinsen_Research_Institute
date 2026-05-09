-- Fix-up for 20260509000000_proposals.sql: default proposals.user_id to
-- auth.uid() so clients can POST without sending it explicitly. The original
-- migration intended this pattern (matches proposal_votes.user_id below it)
-- but missed it on proposals, causing every authenticated INSERT to fail RLS:
--
--   "new row violates row-level security policy for table 'proposals'"
--
-- because the row landed with user_id = NULL and the policy WITH CHECK
-- (user_id = auth.uid()) evaluates NULL = uuid → NULL → false.
--
-- Re-runnable without error: ALTER COLUMN ... SET DEFAULT will re-apply the
-- same default if it's already set, never raising. Not strictly a no-op (the
-- catalog write happens) but harmless on a project already manually fixed.

ALTER TABLE "public"."proposals"
    ALTER COLUMN "user_id" SET DEFAULT auth.uid();
