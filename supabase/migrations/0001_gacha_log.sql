-- Gacha Draw History feature.
-- Run in Supabase SQL editor (or psql against the Supabase Postgres URL).
-- Idempotent: safe to re-run; uses CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS.

-- ===========================================================================
-- gacha_banners
-- A user-scoped gacha pool (e.g. "S5 攻城武將池"). Each banner has its own
-- pity counter (derived from the banner's draws on the client side).
-- ===========================================================================
create table if not exists public.gacha_banners (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists gacha_banners_user_idx
  on public.gacha_banners (user_id, is_active, sort_order);

alter table public.gacha_banners enable row level security;

drop policy if exists gacha_banners_owner_select on public.gacha_banners;
create policy gacha_banners_owner_select on public.gacha_banners
  for select using (user_id = auth.uid());

drop policy if exists gacha_banners_owner_insert on public.gacha_banners;
create policy gacha_banners_owner_insert on public.gacha_banners
  for insert with check (user_id = auth.uid());

drop policy if exists gacha_banners_owner_update on public.gacha_banners;
create policy gacha_banners_owner_update on public.gacha_banners
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists gacha_banners_owner_delete on public.gacha_banners;
create policy gacha_banners_owner_delete on public.gacha_banners
  for delete using (user_id = auth.uid());

-- Table-level GRANTs. RLS only filters rows; without these, PostgREST
-- rejects the request as "permission denied" before policies are evaluated.
grant select, insert, update, delete on public.gacha_banners to authenticated;


-- ===========================================================================
-- gacha_draws
-- Append-only log of SSR draws. "Rare" is a property of the hero name (per
-- banner), stored on gacha_banners.rare_heroes — NOT on each draw row. Pity
-- counter is derived by scanning draws back to the most recent one whose
-- hero_jp is in the banner's rare_heroes set.
-- ===========================================================================
create table if not exists public.gacha_draws (
  id          bigserial primary key,
  user_id     uuid not null references auth.users on delete cascade,
  banner_id   uuid not null references public.gacha_banners on delete cascade,
  hero_jp     text not null,
  rarity      smallint not null default 3,
  note        text,
  drawn_at    timestamptz not null default now()
);

create index if not exists gacha_draws_user_banner_drawn_idx
  on public.gacha_draws (user_id, banner_id, drawn_at desc);

alter table public.gacha_draws enable row level security;

drop policy if exists gacha_draws_owner_select on public.gacha_draws;
create policy gacha_draws_owner_select on public.gacha_draws
  for select using (user_id = auth.uid());

drop policy if exists gacha_draws_owner_insert on public.gacha_draws;
create policy gacha_draws_owner_insert on public.gacha_draws
  for insert with check (user_id = auth.uid());

drop policy if exists gacha_draws_owner_delete on public.gacha_draws;
create policy gacha_draws_owner_delete on public.gacha_draws
  for delete using (user_id = auth.uid());

-- gacha_draws is append-only at the row level: heroes/rarity/timestamps
-- never change after insert. "Rare" lives on gacha_banners.rare_heroes,
-- not here, so no UPDATE policy or grant is needed.
grant select, insert, delete on public.gacha_draws to authenticated;
grant usage, select on sequence public.gacha_draws_id_seq to authenticated;
