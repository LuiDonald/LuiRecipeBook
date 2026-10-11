-- Migration: review queue for agent-submitted recipes.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Recipes created by the agent API land as 'pending' and are hidden from the
-- app and from the API's default list until the owner approves them (status ->
-- 'published'). Rejecting a pending recipe hard-deletes it. Recipes created in
-- the app by the owner are 'published' immediately (the column default).

alter table public.recipes
  add column if not exists status text not null default 'published';

-- Guard against unexpected values.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recipes_status_check'
  ) then
    alter table public.recipes
      add constraint recipes_status_check
      check (status in ('published', 'pending'));
  end if;
end $$;

-- Fast lookup of the (usually small) review queue.
create index if not exists recipes_pending_idx
  on public.recipes (created_at desc)
  where status = 'pending' and deleted_at is null;
