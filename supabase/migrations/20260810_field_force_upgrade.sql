-- SM HRMS · Field Force + Reporting Manager upgrade
-- Safe migration: adds fields/table and replaces only the named RLS policies.
-- Run in Supabase SQL Editor once. Existing attendance/leave/task/visit data is preserved.

begin;

-- ---------------------------------------------------------------------------
-- 1) Field visit lifecycle fields
-- ---------------------------------------------------------------------------
alter table public.field_visits add column if not exists assigned_by uuid references public.profiles(id) on delete set null;
alter table public.field_visits add column if not exists accepted_at timestamptz;
alter table public.field_visits add column if not exists travel_started_at timestamptz;
alter table public.field_visits add column if not exists reached_at timestamptz;
alter table public.field_visits add column if not exists meeting_started_at timestamptz;
alter table public.field_visits add column if not exists completed_at timestamptz;
alter table public.field_visits add column if not exists last_lat double precision;
alter table public.field_visits add column if not exists last_lng double precision;
alter table public.field_visits add column if not exists last_location_at timestamptz;
alter table public.field_visits add column if not exists person_met text default '';
alter table public.field_visits add column if not exists outcome text default '';
alter table public.field_visits add column if not exists completion_notes text default '';
alter table public.field_visits add column if not exists next_followup_at timestamptz;

create index if not exists field_visits_employee_status_idx on public.field_visits(employee_id, status);
create index if not exists field_visits_company_date_idx on public.field_visits(company_id, visit_date desc);
create index if not exists field_visits_last_location_idx on public.field_visits(company_id, last_location_at desc);

-- ---------------------------------------------------------------------------
-- 2) 5-minute location history during an active official visit
-- ---------------------------------------------------------------------------
create table if not exists public.visit_location_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  visit_id uuid not null references public.field_visits(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m integer,
  speed_mps double precision,
  heading double precision,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists visit_location_visit_time_idx on public.visit_location_history(visit_id, captured_at desc);
create index if not exists visit_location_employee_time_idx on public.visit_location_history(employee_id, captured_at desc);
create index if not exists visit_location_company_time_idx on public.visit_location_history(company_id, captured_at desc);

alter table public.visit_location_history enable row level security;

-- ---------------------------------------------------------------------------
-- 3) Field visit RLS: employee self, owner/admin company-wide,
--    manager only direct reports via reports_to_me(employee_id)
-- ---------------------------------------------------------------------------
drop policy if exists visits_insert on public.field_visits;
drop policy if exists visits_select on public.field_visits;
drop policy if exists visits_update on public.field_visits;
drop policy if exists visits_delete on public.field_visits;

create policy visits_select on public.field_visits
for select to authenticated
using (
  company_id = public.my_company_id()
  and (employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(employee_id))
);

create policy visits_insert on public.field_visits
for insert to authenticated
with check (
  company_id = public.my_company_id()
  and (employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(employee_id))
);

create policy visits_update on public.field_visits
for update to authenticated
using (
  company_id = public.my_company_id()
  and (employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(employee_id))
)
with check (
  company_id = public.my_company_id()
  and (employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(employee_id))
);

create policy visits_delete on public.field_visits
for delete to authenticated
using (
  company_id = public.my_company_id()
  and (public.is_company_admin() or public.reports_to_me(employee_id))
);

-- Location history: employees can insert only their own visit pings.
-- Managers/admin can read direct-report/company locations; employees can read own route.
drop policy if exists visit_location_select on public.visit_location_history;
drop policy if exists visit_location_insert on public.visit_location_history;
drop policy if exists visit_location_delete on public.visit_location_history;

create policy visit_location_select on public.visit_location_history
for select to authenticated
using (
  company_id = public.my_company_id()
  and (employee_id = auth.uid() or public.is_company_admin() or public.reports_to_me(employee_id))
);

create policy visit_location_insert on public.visit_location_history
for insert to authenticated
with check (
  company_id = public.my_company_id()
  and employee_id = auth.uid()
  and exists (
    select 1 from public.field_visits fv
    where fv.id = visit_id
      and fv.company_id = public.my_company_id()
      and fv.employee_id = auth.uid()
      and fv.status in ('accepted','on_the_way','reached','checked_in','meeting')
  )
);

create policy visit_location_delete on public.visit_location_history
for delete to authenticated
using (company_id = public.my_company_id() and public.is_company_admin());

-- ---------------------------------------------------------------------------
-- 4) Tasks: reporting manager can assign/read/update tasks for direct reports.
-- ---------------------------------------------------------------------------
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert_by_admin on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete_by_admin on public.tasks;

create policy tasks_select on public.tasks
for select to authenticated
using (
  company_id = public.my_company_id()
  and (
    assignee_id = auth.uid()
    or created_by = auth.uid()
    or public.is_company_admin()
    or (assignee_id is not null and public.reports_to_me(assignee_id))
  )
);

create policy tasks_insert on public.tasks
for insert to authenticated
with check (
  company_id = public.my_company_id()
  and (
    public.is_company_admin()
    or (assignee_id is not null and public.reports_to_me(assignee_id) and created_by = auth.uid())
  )
);

create policy tasks_update on public.tasks
for update to authenticated
using (
  company_id = public.my_company_id()
  and (
    assignee_id = auth.uid()
    or public.is_company_admin()
    or (assignee_id is not null and public.reports_to_me(assignee_id))
  )
)
with check (company_id = public.my_company_id());

create policy tasks_delete on public.tasks
for delete to authenticated
using (
  company_id = public.my_company_id()
  and (public.is_company_admin() or (assignee_id is not null and public.reports_to_me(assignee_id)))
);

-- Realtime support for manager live-location screens.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visit_location_history'
  ) then
    alter publication supabase_realtime add table public.visit_location_history;
  end if;
exception when others then
  raise notice 'Realtime publication was not changed automatically: %', sqlerrm;
end $$;

commit;
