-- This file is a CLI-generated reality patch on top of the baseline.
-- Two things to know:
--   1. The `revoke ... from anon/service_role` lines reflect that the
--      original `db dump` missed Supabase's default-privilege grants. The
--      revokes correctly remove CRUD from anon/service_role on user-owned
--      tables (those tables are RLS-gated for the `authenticated` role only).
-- The original CLI output also tried to `drop extension "pg_net"` — that
-- was a false positive (db dump --schema public doesn't include extensions)
-- and has been stripped, since pg_net is required by Supabase internals.

revoke delete on table "public"."character_profiles" from "anon";

revoke insert on table "public"."character_profiles" from "anon";

revoke select on table "public"."character_profiles" from "anon";

revoke update on table "public"."character_profiles" from "anon";

revoke delete on table "public"."character_profiles" from "service_role";

revoke insert on table "public"."character_profiles" from "service_role";

revoke select on table "public"."character_profiles" from "service_role";

revoke update on table "public"."character_profiles" from "service_role";

revoke delete on table "public"."shares" from "anon";

revoke update on table "public"."shares" from "anon";

revoke delete on table "public"."shares" from "service_role";

revoke insert on table "public"."shares" from "service_role";

revoke select on table "public"."shares" from "service_role";

revoke update on table "public"."shares" from "service_role";





