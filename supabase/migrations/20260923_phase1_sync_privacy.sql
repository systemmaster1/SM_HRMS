-- =============================================================================
-- SM HRMS · Phase 1 · Google Sheet sync + privacy fixes
-- Run ONCE in Supabase → SQL Editor, BEFORE deploying the Phase 1 code.
-- Safe: nothing is deleted. Existing sheet URL/secret values are copied over.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Google Sheet secret moves to an admin-only table.
--    Before this, every employee could read companies.gsheet_secret and
--    overwrite the company's Google Sheet.
-- -----------------------------------------------------------------------------
create table if not exists public.company_integrations (
  company_id         uuid primary key references public.companies(id) on delete cascade,
  gsheet_webhook_url text,
  gsheet_secret      text,
  updated_at         timestamptz not null default now()
);

alter table public.company_integrations enable row level security;

drop policy if exists company_integrations_select on public.company_integrations;
drop policy if exists company_integrations_insert on public.company_integrations;
drop policy if exists company_integrations_update on public.company_integrations;

create policy company_integrations_select on public.company_integrations
for select to authenticated
using (company_id = public.my_company_id() and public.is_company_admin());

create policy company_integrations_insert on public.company_integrations
for insert to authenticated
with check (company_id = public.my_company_id() and public.is_company_admin());

create policy company_integrations_update on public.company_integrations
for update to authenticated
using (company_id = public.my_company_id() and public.is_company_admin())
with check (company_id = public.my_company_id() and public.is_company_admin());

-- Copy existing settings (only if the old columns exist).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'companies'
               and column_name = 'gsheet_webhook_url') then
    insert into public.company_integrations (company_id, gsheet_webhook_url, gsheet_secret)
    select id, gsheet_webhook_url, gsheet_secret
    from public.companies
    where coalesce(gsheet_webhook_url, '') <> '' or coalesce(gsheet_secret, '') <> ''
    on conflict (company_id) do update
      set gsheet_webhook_url = coalesce(public.company_integrations.gsheet_webhook_url, excluded.gsheet_webhook_url),
          gsheet_secret      = coalesce(public.company_integrations.gsheet_secret, excluded.gsheet_secret);
  end if;
end $$;

-- These two non-secret columns stay on companies (the code expects them).
alter table public.companies add column if not exists gsheet_backup_enabled boolean not null default false;
alter table public.companies add column if not exists gsheet_last_backup timestamptz;

-- -----------------------------------------------------------------------------
-- 2) Sync log - every automatic / manual sync is recorded.
-- -----------------------------------------------------------------------------
create table if not exists public.gsheet_sync_logs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  trigger      text not null default 'cron' check (trigger in ('cron', 'manual', 'auto')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  tabs         integer,
  rows_written integer,
  error        text
);

create index if not exists gsheet_sync_logs_company_time_idx
  on public.gsheet_sync_logs(company_id, started_at desc);

alter table public.gsheet_sync_logs enable row level security;

drop policy if exists gsheet_sync_logs_select on public.gsheet_sync_logs;
create policy gsheet_sync_logs_select on public.gsheet_sync_logs
for select to authenticated
using (company_id = public.my_company_id() and public.is_company_admin());
-- Inserts/updates are done only by the server (service role), so no write policy.

-- Keep 120 days of logs.
create or replace function public.trim_gsheet_sync_logs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.gsheet_sync_logs
  where company_id = new.company_id and started_at < now() - interval '120 days';
  return new;
end $$;

drop trigger if exists gsheet_sync_logs_trim on public.gsheet_sync_logs;
create trigger gsheet_sync_logs_trim after insert on public.gsheet_sync_logs
for each row execute function public.trim_gsheet_sync_logs();

-- -----------------------------------------------------------------------------
-- 3) Attendance selfies + employee documents become PRIVATE.
--    Files are shown through short-lived signed URLs to:
--      the employee themself, owner/admin of the same company,
--      and the employee's reporting manager.
--    File paths are "<company_id>/<employee_id>/<file>".
-- -----------------------------------------------------------------------------
create or replace function public.try_uuid(p text) returns uuid
language sql immutable as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then p::uuid else null end
$$;

create or replace function public.can_view_employee_file(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select
    (storage.foldername(p_name))[1] = public.my_company_id()::text
    and (
      (storage.foldername(p_name))[2] = auth.uid()::text
      or public.is_company_admin()
      or coalesce(public.reports_to_me(public.try_uuid((storage.foldername(p_name))[2])), false)
    )
$$;

grant execute on function public.can_view_employee_file(text) to authenticated;

update storage.buckets set public = false
where id in ('attendance-photos', 'employee-docs');

-- attendance-photos: read (self / admin / manager), upload only into own folder.
drop policy if exists smhrms_attendance_photos_read   on storage.objects;
drop policy if exists smhrms_attendance_photos_insert on storage.objects;

create policy smhrms_attendance_photos_read on storage.objects
for select to authenticated
using (bucket_id = 'attendance-photos' and public.can_view_employee_file(name));

create policy smhrms_attendance_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'attendance-photos'
  and (storage.foldername(name))[1] = public.my_company_id()::text
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- employee-docs: read (self / admin / manager), upload by admin or the employee, delete by admin.
drop policy if exists smhrms_employee_docs_read   on storage.objects;
drop policy if exists smhrms_employee_docs_insert on storage.objects;
drop policy if exists smhrms_employee_docs_delete on storage.objects;

create policy smhrms_employee_docs_read on storage.objects
for select to authenticated
using (bucket_id = 'employee-docs' and public.can_view_employee_file(name));

create policy smhrms_employee_docs_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'employee-docs'
  and (storage.foldername(name))[1] = public.my_company_id()::text
  and (public.is_company_admin() or (storage.foldername(name))[2] = auth.uid()::text)
);

create policy smhrms_employee_docs_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'employee-docs'
  and (storage.foldername(name))[1] = public.my_company_id()::text
  and public.is_company_admin()
);

commit;

-- -----------------------------------------------------------------------------
-- AFTER RUNNING: check for OLD, broader storage policies.
-- Policies are OR-ed together, so an old "anyone can read" policy would still
-- let every logged-in user of every company open these files. Run this query;
-- if any row other than the smhrms_* ones shows up for these two buckets,
-- drop it with:  drop policy "<policyname>" on storage.objects;
--
--   select policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and (qual ilike '%attendance-photos%' or qual ilike '%employee-docs%'
--          or with_check ilike '%attendance-photos%' or with_check ilike '%employee-docs%'
--          or qual not ilike '%bucket_id%');
-- -----------------------------------------------------------------------------
