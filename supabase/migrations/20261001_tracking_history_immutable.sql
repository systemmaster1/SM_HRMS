-- SM HRMS · Field tracking audit hardening
-- Employees/managers may read authorized tracking history but cannot edit/delete it.
-- Owner/Admin can configure tracking, but recorded GPS history remains append-only.
-- Safe to re-run. Existing data is preserved.
begin;

alter table public.employee_location_history enable row level security;
alter table public.tracking_events enable row level security;

drop policy if exists employee_location_history_update on public.employee_location_history;
drop policy if exists employee_location_history_delete on public.employee_location_history;
drop policy if exists tracking_events_update on public.tracking_events;
drop policy if exists tracking_events_delete on public.tracking_events;

-- No UPDATE/DELETE policies are intentionally created.
-- New coordinates/events are appended by the authenticated employee/native app
-- through the existing insert/RPC path. Historical records cannot be rewritten
-- through the browser API, including by the employee whose route was recorded.

create or replace function public.smhrms_lock_location_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Recorded location history is immutable';
end;
$$;

drop trigger if exists trg_smhrms_lock_location_history on public.employee_location_history;
create trigger trg_smhrms_lock_location_history
before update or delete on public.employee_location_history
for each row execute function public.smhrms_lock_location_history();

create or replace function public.smhrms_lock_tracking_events()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Recorded tracking events are immutable';
end;
$$;

drop trigger if exists trg_smhrms_lock_tracking_events on public.tracking_events;
create trigger trg_smhrms_lock_tracking_events
before update or delete on public.tracking_events
for each row execute function public.smhrms_lock_tracking_events();

commit;
