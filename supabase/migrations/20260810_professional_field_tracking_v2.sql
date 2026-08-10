-- SM HRMS · Professional Sales / Field Tracking v2
-- Run AFTER 20260810_field_force_upgrade.sql
-- Safe additive migration. Existing HRMS records are preserved.

begin;

alter table public.profiles add column if not exists employee_type text not null default 'office';
alter table public.profiles add column if not exists field_tracking_enabled boolean not null default false;
alter table public.profiles add column if not exists tracking_mode text not null default 'active_visit';
alter table public.profiles add column if not exists tracking_interval_minutes integer not null default 5;
alter table public.profiles add column if not exists tracking_stale_after_minutes integer not null default 10;
alter table public.profiles add column if not exists route_history_enabled boolean not null default true;

alter table public.profiles drop constraint if exists profiles_employee_type_check;
alter table public.profiles add constraint profiles_employee_type_check check (employee_type in ('office','sales','field','hybrid'));
alter table public.profiles drop constraint if exists profiles_tracking_mode_check;
alter table public.profiles add constraint profiles_tracking_mode_check check (tracking_mode in ('active_visit','working_hours','manual'));
alter table public.profiles drop constraint if exists profiles_tracking_interval_check;
alter table public.profiles add constraint profiles_tracking_interval_check check (tracking_interval_minutes between 1 and 60);
alter table public.profiles drop constraint if exists profiles_tracking_stale_check;
alter table public.profiles add constraint profiles_tracking_stale_check check (tracking_stale_after_minutes between 2 and 120);

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  visit_id uuid references public.field_visits(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  event_time timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tracking_events_employee_time_idx on public.tracking_events(employee_id, event_time desc);
create index if not exists tracking_events_company_time_idx on public.tracking_events(company_id, event_time desc);
create index if not exists tracking_events_visit_time_idx on public.tracking_events(visit_id, event_time desc);

alter table public.tracking_events enable row level security;

drop policy if exists tracking_events_select on public.tracking_events;
drop policy if exists tracking_events_insert on public.tracking_events;
drop policy if exists tracking_events_delete on public.tracking_events;

create policy tracking_events_select on public.tracking_events
for select to authenticated
using (
  company_id = public.my_company_id()
  and (employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(employee_id))
);

create policy tracking_events_insert on public.tracking_events
for insert to authenticated
with check (
  company_id = public.my_company_id()
  and employee_id = auth.uid()
);

create policy tracking_events_delete on public.tracking_events
for delete to authenticated
using (company_id = public.my_company_id() and public.is_company_admin());

-- Prevent employees/managers from changing their own tracking controls through direct API calls.
create or replace function public.protect_tracking_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    new.field_tracking_enabled is distinct from old.field_tracking_enabled
    or new.employee_type is distinct from old.employee_type
    or new.tracking_mode is distinct from old.tracking_mode
    or new.tracking_interval_minutes is distinct from old.tracking_interval_minutes
    or new.tracking_stale_after_minutes is distinct from old.tracking_stale_after_minutes
    or new.route_history_enabled is distinct from old.route_history_enabled
  ) and not public.is_company_admin() then
    raise exception 'Only company Owner/Admin can change field tracking settings';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_tracking_config on public.profiles;
create trigger trg_protect_tracking_config
before update on public.profiles
for each row execute function public.protect_tracking_config();

-- Realtime for tracking status/events.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tracking_events'
  ) then
    alter publication supabase_realtime add table public.tracking_events;
  end if;
exception when others then
  raise notice 'Realtime publication was not changed automatically: %', sqlerrm;
end $$;

commit;
