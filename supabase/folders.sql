-- Folders ("categories") as first-class, manageable records.
--
-- Previously folders were derived purely from a hardcoded list + whatever
-- categories appeared in recipe rows. This table lets the owner CREATE and
-- (soft) DELETE folders from the app, while still recovering them later.
--
-- Model:
--   * A row is a "managed" folder. `deleted_at` = soft-deleted (hidden).
--   * The canonical categories are seeded below.
--   * Categories that appear in recipe data but have NO row here are shown as
--     extras by the app; deleting one inserts a tombstone row (deleted_at set)
--     so it stays hidden yet recoverable.

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '📁',
  sort_order int not null default 1000,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists folders_active_idx
  on public.folders (sort_order, name)
  where deleted_at is null;

alter table public.folders enable row level security;

-- Public read (the app shows folders to everyone, like public recipe read).
drop policy if exists folders_read on public.folders;
create policy folders_read on public.folders
  for select using (true);

-- Only the owner may create / update / delete folders.
drop policy if exists folders_owner_write on public.folders;
create policy folders_owner_write on public.folders
  for all
  using (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com');

-- Seed the canonical categories (idempotent).
insert into public.folders (name, icon, sort_order) values
  ('Chicken', '🍗', 10),
  ('Beef', '🥩', 20),
  ('Pork', '🥓', 30),
  ('Lamb', '🍖', 40),
  ('Seafood', '🦐', 50),
  ('Egg', '🥚', 60),
  ('Vegetable', '🥦', 70),
  ('Soup', '🍲', 80),
  ('Rice Bowl / Ramen / Noodle', '🍜', 90),
  ('Dessert', '🍰', 100),
  ('Drink', '🥤', 110)
on conflict (name) do nothing;
