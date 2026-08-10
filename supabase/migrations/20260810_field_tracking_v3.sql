-- SM HRMS · Advanced Field Tracking v3
-- Run after the v1 + v2 field tracking migrations.
-- Safe additive migration: no existing attendance/task/visit records are deleted.

begin;

-- Visit planning / SLA fields for delay & productivity reports.
alter table public.field_visits add column if not exists scheduled_at timestamptz;
alter table public.field_visits add column if not exists target_duration_minutes integer not null default 60;
alter table public.field_visits add column if not exists destination_lat double precision;
alter table public.field_visits add column if not exists destination_lng double precision;

alter table public.field_visits drop constraint if exists field_visits_target_duration_check;
alter table public.field_visits add constraint field_visits_target_duration_check
check (target_duration_minutes between 5 and 1440);

create index if not exists field_visits_scheduled_idx
on public.field_visits(company_id, scheduled_at desc);

-- Latest location/status: one row per employee. This powers the Owner/Manager live dashboard.
create table if not exists public.employee_live_locations (
  employee_id uuid primary key references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  visit_id uuid references public.field_visits(id) on delete set null,
  latitude double precision,
  longitude double precision,
  accuracy_m integer,
  speed_mps double precision,
  heading double precision,
  permission_state text not null default 'unknown',
  tracking_state text not null default 'idle',
  app_state text not null default 'foreground',
  last_seen_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create index if not exists employee_live_locations_company_seen_idx
on public.employee_live_locations(company_id, last_seen_at desc);

alter table public.employee_live_locations enable row level security;

drop policy if exists employee_live_select on public.employee_live_locations;
drop policy if exists employee_live_insert on public.employee_live_locations;
drop policy if exists employee_live_update on public.employee_live_locations;
drop policy if exists employee_live_delete on public.employee_live_locations;

create policy employee_live_select on public.employee_live_locations
for select to authenticated
using (
  company_id = public.my_company_id()
  and (employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(employee_id))
);

create policy employee_live_insert on public.employee_live_locations
for insert to authenticated
with check (company_id = public.my_company_id() and employee_id = auth.uid());

create policy employee_live_update on public.employee_live_locations
for update to authenticated
using (company_id = public.my_company_id() and employee_id = auth.uid())
with check (company_id = public.my_company_id() and employee_id = auth.uid());

create policy employee_live_delete on public.employee_live_locations
for delete to authenticated
using (company_id = public.my_company_id() and public.is_company_admin());

-- General location history supports Active Visit AND Working Hours tracking modes.
create table if not exists public.employee_location_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  visit_id uuid references public.field_visits(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m integer,
  speed_mps double precision,
  heading double precision,
  source text not null default 'web_pwa',
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists employee_location_history_employee_time_idx
on public.employee_location_history(employee_id, captured_at desc);
create index if not exists employee_location_history_company_time_idx
on public.employee_location_history(company_id, captured_at desc);
create index if not exists employee_location_history_visit_time_idx
on public.employee_location_history(visit_id, captured_at desc);

alter table public.employee_location_history enable row level security;

drop policy if exists employee_location_history_select on public.employee_location_history;
drop policy if exists employee_location_history_insert on public.employee_location_history;
drop policy if exists employee_location_history_delete on public.employee_location_history;

create policy employee_location_history_select on public.employee_location_history
for select to authenticated
using (
  company_id = public.my_company_id()
  and (employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(employee_id))
);

create policy employee_location_history_insert on public.employee_location_history
for insert to authenticated
with check (company_id = public.my_company_id() and employee_id = auth.uid());

create policy employee_location_history_delete on public.employee_location_history
for delete to authenticated
using (company_id = public.my_company_id() and public.is_company_admin());

-- Reliable Owner/Admin update endpoint for tracking setup.
-- This avoids client-side policy ambiguity while still validating company + admin role.
create or replace function public.set_employee_tracking_config(
  p_employee_id uuid,
  p_enabled boolean,
  p_employee_type text default 'field',
  p_tracking_mode text default 'active_visit',
  p_interval_minutes integer default 5,
  p_stale_minutes integer default 10,
  p_route_history boolean default true
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles;
begin
  if not public.is_company_admin() then
    raise exception 'Only Owner/Admin can change field tracking settings';
  end if;

  if p_employee_type not in ('office','sales','field','hybrid') then
    raise exception 'Invalid employee type';
  end if;
  if p_tracking_mode not in ('active_visit','working_hours','manual') then
    raise exception 'Invalid tracking mode';
  end if;
  if p_interval_minutes < 1 or p_interval_minutes > 60 then
    raise exception 'Tracking interval must be 1-60 minutes';
  end if;
  if p_stale_minutes < 2 or p_stale_minutes > 120 then
    raise exception 'Stale threshold must be 2-120 minutes';
  end if;

  update public.profiles
  set field_tracking_enabled = p_enabled,
      employee_type = p_employee_type,
      tracking_mode = p_tracking_mode,
      tracking_interval_minutes = p_interval_minutes,
      tracking_stale_after_minutes = p_stale_minutes,
      route_history_enabled = p_route_history
  where id = p_employee_id
    and company_id = public.my_company_id()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Employee not found in your company';
  end if;

  return v_row;
end;
$$;

grant execute on function public.set_employee_tracking_config(uuid, boolean, text, text, integer, integer, boolean) to authenticated;

-- Realtime feeds for dashboards.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employee_live_locations'
  ) then
    alter publication supabase_realtime add table public.employee_live_locations;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employee_location_history'
  ) then
    alter publication supabase_realtime add table public.employee_location_history;
  end if;
exception when others then
  raise notice 'Realtime publication was not changed automatically: %', sqlerrm;
end $$;

commit;
