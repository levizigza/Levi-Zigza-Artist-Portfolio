-- Supabase Storage setup for Arist Portfolio uploads
-- Run in the Supabase SQL editor (Dashboard → SQL).
-- Bucket name must match SUPABASE_BUCKET / VITE_SUPABASE_BUCKET (default: portfolio).

-- 1) Public media bucket
insert into storage.buckets (id, name, public, file_size_limit)
values ('portfolio', 'portfolio', true, 134217728)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit;

-- 2) Anyone can read objects (chambers + GitHub Pages need public URLs)
create policy "Public read portfolio media"
on storage.objects
for select
to public
using (bucket_id = 'portfolio');

-- 3) Writes go through the Express admin API with SUPABASE_SERVICE_ROLE_KEY
--    (service role bypasses RLS). Do not expose the service role to the browser.
--
-- Optional: if you later add authenticated client uploads, add policies like:
--   create policy "Auth upload portfolio"
--   on storage.objects for insert to authenticated
--   with check (bucket_id = 'portfolio');

-- After setup, set in .env:
--   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
--   SUPABASE_SERVICE_ROLE_KEY=...
--   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
--   VITE_SUPABASE_ANON_KEY=...   (optional; public URLs do not require it)
--   VITE_SUPABASE_BUCKET=portfolio
