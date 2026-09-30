-- Migration: cooking notes / refinement history for the agent API.
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Append-only log of cooking notes attached to a recipe (e.g. "used 1.5 tsp
-- salt", "swapped to Lee Kum Kee soy sauce"). The agent API writes here via the
-- service_role key (which bypasses RLS); the policies below govern app/anon.

create table if not exists public.recipe_notes (
  id         uuid primary key default gen_random_uuid(),
  recipe_id  uuid not null references public.recipes(id) on delete cascade,
  text       text not null,
  author     text not null default 'agent',
  created_at timestamptz not null default now()
);

create index if not exists recipe_notes_recipe_idx
  on public.recipe_notes (recipe_id, created_at);

alter table public.recipe_notes enable row level security;

-- App/anon may READ notes (so the Expo app can show them later if desired).
drop policy if exists "public read recipe notes" on public.recipe_notes;
create policy "public read recipe notes"
  on public.recipe_notes for select
  using (true);

-- Owner (magic-link) may write from the app. The agent API uses service_role,
-- which bypasses RLS entirely, so it can append regardless of these policies.
drop policy if exists "owner writes recipe notes" on public.recipe_notes;
create policy "owner writes recipe notes"
  on public.recipe_notes for all to authenticated
  using (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com');
