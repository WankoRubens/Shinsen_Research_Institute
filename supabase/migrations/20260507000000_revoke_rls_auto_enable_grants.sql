-- Revoke EXECUTE on public.rls_auto_enable() from anon/authenticated/PUBLIC.
--
-- The function is a DDL event-trigger handler (RETURNS event_trigger) and
-- should only ever be invoked by the PostgreSQL event-trigger machinery
-- running as the function owner. The original baseline GRANT ALL was
-- overly permissive for a SECURITY DEFINER function; Supabase's linter
-- (lint 0028/0029) flags it as callable by anon/authenticated.
--
-- Calling an event_trigger function via /rest/v1/rpc would already fail
-- at runtime, but tightening the grants matches least-privilege and
-- silences the linter warning.

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "authenticated";
