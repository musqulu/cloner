create sequence if not exists public.clone_archive_number_seq
  as bigint
  start with 124
  increment by 1
  minvalue 1
  cache 1;

alter table public.clone_sessions
add column if not exists archive_number bigint;

update public.clone_sessions
set archive_number = nextval('public.clone_archive_number_seq')
where archive_number is null;

select setval(
  'public.clone_archive_number_seq',
  greatest(
    coalesce((select max(archive_number) from public.clone_sessions), 123),
    123
  ),
  true
);

alter table public.clone_sessions
alter column archive_number set default nextval('public.clone_archive_number_seq');

alter table public.clone_sessions
alter column archive_number set not null;

create unique index if not exists clone_sessions_archive_number_key
on public.clone_sessions (archive_number);

create or replace function public.set_clone_archive_label()
returns trigger
language plpgsql
as $$
begin
  if new.archive_number is not null then
    new.participant_label = '#' || lpad(new.archive_number::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists clone_sessions_archive_label on public.clone_sessions;
create trigger clone_sessions_archive_label
before insert or update of archive_number, participant_label on public.clone_sessions
for each row
execute function public.set_clone_archive_label();

update public.clone_sessions
set participant_label = '#' || lpad(archive_number::text, 5, '0')
where archive_number is not null;
