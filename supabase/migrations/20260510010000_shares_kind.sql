-- Add explicit kind discriminator to shares so the "我的分享" list view can
-- show a type label without fetching every blob. Pre-existing rows get
-- backfilled by inspecting blob shape and display_name prefix.

ALTER TABLE public.shares
  ADD COLUMN kind text NOT NULL DEFAULT 'lineup';

ALTER TABLE public.shares
  ADD CONSTRAINT shares_kind_check
  CHECK (kind IN ('lineup', 'group', 'inventory', 'profile'));

-- Backfill existing rows. Profile is identified by display_name prefix (the
-- only signal we have, since blob shape is identical to inventory shares);
-- v3 groups → group; v2 lineups[N>1] → group, lineups[1] → lineup;
-- inventory-only when no teams present; everything else falls back to lineup.
UPDATE public.shares SET kind = CASE
  WHEN display_name LIKE '角色配置：%' THEN 'profile'
  WHEN blob ? 'groups' THEN 'group'
  WHEN jsonb_typeof(blob->'lineups') = 'array' AND jsonb_array_length(blob->'lineups') > 1 THEN 'group'
  WHEN blob ? 'lineups' THEN 'lineup'
  WHEN blob ? 'inv_h' OR blob ? 'inventory' THEN 'inventory'
  ELSE 'lineup'
END;

CREATE INDEX shares_kind_idx ON public.shares (kind);
