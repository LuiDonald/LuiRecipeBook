-- Recipe app — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).

-- Enable UUID generation (pgcrypto ships with Supabase).
create extension if not exists "pgcrypto";

create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text default '',
  category    text default '',
  photo_url   text,
  ingredients text[] not null default '{}',
  steps       text[] not null default '{}',
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists recipes_updated_at_idx
  on public.recipes (updated_at desc);

create index if not exists recipes_category_idx
  on public.recipes (category);

-- Row Level Security.
-- Public can READ everything; only the OWNER (a single email, signed in via
-- magic link) can INSERT / UPDATE / DELETE.
alter table public.recipes enable row level security;

-- Remove older/dev policies if present.
drop policy if exists "recipes are publicly accessible (dev)" on public.recipes;
drop policy if exists "public read recipes" on public.recipes;
drop policy if exists "owner insert recipes" on public.recipes;
drop policy if exists "owner update recipes" on public.recipes;
drop policy if exists "owner delete recipes" on public.recipes;

-- Anyone (even logged out) can read.
create policy "public read recipes"
  on public.recipes for select
  using (true);

-- Only the owner can write.
create policy "owner insert recipes"
  on public.recipes for insert to authenticated
  with check (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com');

create policy "owner update recipes"
  on public.recipes for update to authenticated
  using (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com')
  with check (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com');

create policy "owner delete recipes"
  on public.recipes for delete to authenticated
  using (lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com');

-- ---------------------------------------------------------------------------
-- Storage bucket for recipe photos (Phase 2).
-- ---------------------------------------------------------------------------

-- Create a PUBLIC bucket named `recipe-photos` (public = anyone can read the
-- image via its URL, which is what the app displays).
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

-- Storage access policies.
-- Photos are publicly readable (so the app can display them); only the OWNER
-- can upload / change / delete them.

drop policy if exists "recipe photos are publicly readable (dev)" on storage.objects;
drop policy if exists "recipe photos are publicly writable (dev)" on storage.objects;
drop policy if exists "recipe photos are publicly updatable (dev)" on storage.objects;
drop policy if exists "recipe photos are publicly deletable (dev)" on storage.objects;
drop policy if exists "public read recipe photos" on storage.objects;
drop policy if exists "owner insert recipe photos" on storage.objects;
drop policy if exists "owner update recipe photos" on storage.objects;
drop policy if exists "owner delete recipe photos" on storage.objects;

create policy "public read recipe photos"
  on storage.objects for select
  using (bucket_id = 'recipe-photos');

create policy "owner insert recipe photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recipe-photos'
    and lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com'
  );

create policy "owner update recipe photos"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'recipe-photos'
    and lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com'
  );

create policy "owner delete recipe photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'recipe-photos'
    and lower(auth.jwt() ->> 'email') = 'donaldtlui@gmail.com'
  );
