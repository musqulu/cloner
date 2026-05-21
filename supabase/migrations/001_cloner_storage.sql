-- Run this in the Supabase SQL Editor (Dashboard → SQL) after creating a project.
-- Creates a private bucket for Cloner session uploads (photos, voice samples, later video).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cloner-uploads',
  'cloner-uploads',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'audio/webm',
    'audio/wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do nothing;

-- Uploads use the service role from Next.js (bypasses RLS). Add policies here if you later allow client-side uploads.
