-- Run this once in your Supabase project's SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste this whole file -> Run)

create table if not exists leeya_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security: this app has its own PIN-based login screen inside
-- the POS itself, not Supabase Auth, so we allow the anon (public) key
-- used by the app to read and write this single table. Anyone who has
-- your Supabase anon key and URL could otherwise read/write this table
-- directly, so keep those values out of public repos if you'd rather
-- lock this down further later (e.g. by adding real Supabase Auth).
alter table leeya_kv enable row level security;

create policy "Allow anon read" on leeya_kv
  for select using (true);

create policy "Allow anon write" on leeya_kv
  for insert with check (true);

create policy "Allow anon update" on leeya_kv
  for update using (true);
