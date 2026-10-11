-- Migration: soft-delete support for recipes.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- A soft delete sets `deleted_at` (and optionally `delete_reason`) instead of
-- removing the row, so an accidental or agent-driven delete is recoverable.
-- Active recipes have deleted_at IS NULL; the app and agent API hide anything
-- with deleted_at set.

alter table public.recipes add column if not exists deleted_at    timestamptz;
alter table public.recipes add column if not exists delete_reason text;

-- Partial index to keep "active recipes" scans fast.
create index if not exists recipes_active_idx
  on public.recipes (updated_at desc)
  where deleted_at is null;
