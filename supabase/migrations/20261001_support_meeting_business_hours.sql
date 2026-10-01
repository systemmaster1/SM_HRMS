-- SM HRMS support meeting booking guard
-- Business hours: Mon-Sat 10:00-19:00 Asia/Kolkata; Sunday closed.
-- Prevents overlapping active support meetings even if a client bypasses the UI.
begin;
create extension if not exists btree_gist with schema extensions;

create or replace function public.enforce_support_meeting_schedule()
returns trigger language plpgsql set search_path=public as $$
declare s_local timestamp; e_local timestamp;
begin
  s_local := new.starts_at at time zone 'Asia/Kolkata';
  e_local := new.ends_at at time zone 'Asia/Kolkata';
  if extract(isodow from s_local)=7 then raise exception 'Support meetings are not available on Sunday'; end if;
  if s_local::date<>e_local::date or s_local::time<time '10:00' or e_local::time>time '19:00' then
    raise exception 'Support meetings can be booked only between 10:00 AM and 7:00 PM IST';
  end if;
  return new;
end $$;

drop trigger if exists support_meeting_schedule_guard on public.support_meetings;
create trigger support_meeting_schedule_guard before insert or update of starts_at,ends_at,status
on public.support_meetings for each row
when (new.status not in ('cancelled','completed'))
execute function public.enforce_support_meeting_schedule();

do $$ begin
 if not exists(select 1 from pg_constraint where conname='support_meetings_no_overlap') then
  alter table public.support_meetings add constraint support_meetings_no_overlap
  exclude using gist (tstzrange(starts_at,ends_at,'[)') with &&)
  where (status not in ('cancelled','completed'));
 end if;
end $$;
commit;