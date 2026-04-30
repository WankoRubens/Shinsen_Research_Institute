-- Add hero_pool to gacha_banners. Each banner now stores the subset of
-- heroes that ARE in this banner; the picker filters to this list so users
-- can click rapidly without scrolling past 200 unrelated SSRs.
--
-- Empty array (default) means "no pool defined yet" — UI treats this as a
-- prompt to set the pool before logging draws.

alter table public.gacha_banners
  add column if not exists hero_pool text[] not null default array[]::text[];

-- Add rare_heroes to gacha_banners. The user picks which hero NAMES count
-- as rare for this banner; every draw of one of those heroes is rendered as
-- rare and resets the pity counter. Stored on the banner (not the draws) so
-- toggling is a single PATCH and the same hero never has inconsistent state
-- across multiple draws.
alter table public.gacha_banners
  add column if not exists rare_heroes text[] not null default array[]::text[];
