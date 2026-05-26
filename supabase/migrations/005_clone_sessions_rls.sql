-- Lock down public.clone_sessions as a server-only table.
--
-- The app has no Supabase Auth: sessions are identified by client-generated
-- UUIDs and all reads/writes happen server-side via the service-role key
-- (see lib/cloner/session-server.ts and lib/supabase/admin.ts). The browser
-- never queries this table with the anon key, so we close it off entirely
-- from anon/authenticated rather than adding policies that would protect
-- nothing.

alter table public.clone_sessions enable row level security;

revoke all on table public.clone_sessions from anon, authenticated;
revoke all on sequence public.clone_archive_number_seq from anon, authenticated;
