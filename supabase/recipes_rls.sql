-- Housekeeping: lock down the `recipes` table + drop a redundant index.
--
-- BEFORE: the only policy was a leftover dev policy
--   ("recipes are publicly accessible (dev)", cmd=ALL, roles=public, using=true)
-- which let ANYONE (even anonymous) insert/update/delete recipes.
--
-- AFTER: public read + owner-only write, matching the proven pattern already
-- used by `recipe_notes` and `folders`. The agent API uses the service_role
-- key (bypasses RLS), so it is unaffected.

alter table public.recipes enable row level security;

-- Remove the wide-open dev policy.
drop policy if exists "recipes are publicly accessible (dev)" on public.recipes;

-- Public read (the app shows recipes to everyone).
drop policy if exists "recipes public read" on public.recipes;
create policy "recipes public read" on public.recipes
  for select using (true);

-- Only the owner may create / update / delete recipes.
drop policy if exists "recipes owner write" on public.recipes;
create policy "recipes owner write" on public.recipes
  for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com');

-- Drop the redundant full-table index. Every app query filters
-- `deleted_at IS NULL`, which is served by the partial `recipes_active_idx`.
drop index if exists public.recipes_updated_at_idx;
