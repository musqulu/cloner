create table if not exists public.clone_sessions (
  id uuid primary key,
  status text not null default 'draft',
  participant_label text,
  personal_truth text,
  language text,
  generated_script text,
  photo_path text,
  voice_path text,
  elevenlabs_voice_id text,
  tts_audio_path text,
  clone_video_path text,
  reaction_path text,
  final_video_path text,
  error_message text,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clone_sessions_updated_at on public.clone_sessions;
create trigger clone_sessions_updated_at
before update on public.clone_sessions
for each row
execute function public.set_updated_at();
