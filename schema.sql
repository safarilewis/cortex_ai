-- ─────────────────────────────────────────────────────────────────────────────
-- Knowledge Graph Notes — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- Notes table
create table if not exists notes (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  content    text        not null default '',
  tags       text[]      not null default '{}',
  created_at timestamptz not null default now()
);

-- Index for fast tag queries
create index if not exists notes_tags_gin on notes using gin(tags);
-- Index for full-text search on title + content
create index if not exists notes_fts on notes
  using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'')));

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Option A: Use the service-role key (bypasses RLS — simplest for server-side)
--   Set SUPABASE_KEY=<service-role-key> in your .env file.
--   No RLS changes needed.
--
-- Option B: Use the anon key with RLS enabled (more secure)
--   Enable RLS, then create a policy:

-- alter table notes enable row level security;
--
-- -- Allow all operations (replace with your auth logic if needed)
-- create policy "allow_all" on notes
--   for all
--   using (true)
--   with check (true);
