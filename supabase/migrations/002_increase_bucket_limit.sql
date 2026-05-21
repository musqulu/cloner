-- Optional: raise per-file limit if reaction webcam recordings exceed 50MB.
-- Run in Supabase SQL Editor if needed.

update storage.buckets
set file_size_limit = 104857600
where id = 'cloner-uploads';
