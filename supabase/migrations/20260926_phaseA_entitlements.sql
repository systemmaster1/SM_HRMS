-- =============================================================================
-- SM HRMS · Phase A · Multi-tenant organization + feature entitlement layer
--
-- Run ONCE in Supabase → SQL Editor, BEFORE uploading the Phase A code.
-- Safe to re-run.
--
-- NON-DESTRUCTIVE:
--   · No table, column, row or existing policy is dropped or changed.
--   · Every existing organization is GRANDFATHERED: all modules stay ON and
--     ads stay OFF, so nothing changes for current clients on day one.
--   · Turning a module off later HIDES its data; it never deletes it.
--
-- Effective access for a module =
--     feature not globally disabled
--   AND organization not suspended
--   AND (organization override  →  else plan setting  →  else "free" default)
--   AND parent module also enabled (e.g. tasks → tasks.checklist)
--   AND (in the app) the user's role / access permission.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0) Platform-admin check that never errors (wraps the existing is_system_admin)
--    SQL editor / service role / postgres-owned jobs count as platform level.
-- -----------------------------------------------------------------------------
create or replace function public.is_platform_admin() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text := nullif(coalesce(
                   nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
                   current_setting('request.jwt.claim.role', true)), '');
  ok boolean := false;
begin
  -- No API request at all (SQL Editor, pg_cron) or the server's service key.
  -- NOTE: current_user is useless here (inside a definer function it is the
  -- owner), so the caller is identified from the request's JWT role.
  if v_role is null or v_role = 'service_role' then
    return true;
  end if;
  if v_role <> 'authenticated' then
    return false;                                   -- anon never qualifies
  end if;
  begin
    execute 'select public.is_system_admin()' into ok;
  exception when others then
    ok := false;
  end;
  return coalesce(ok, false);
end $$;

-- -----------------------------------------------------------------------------
-- 1) FEATURE CATALOGUE — one row per module / sub-feature.
--    availability: free | paid | coming_soon | disabled  (set by SystemMaster)
--    Adding a module later = one row here + one entry in src/lib/features/registry.ts
-- -----------------------------------------------------------------------------
create table if not exists public.features (
  key          text primary key,
  parent_key   text references public.features(key) on delete restrict,
  name         text not null,
  description  text,
  availability text not null default 'paid'
               check (availability in ('free', 'paid', 'coming_soon', 'disabled')),
  sort_order   integer not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.features enable row level security;
drop policy if exists features_read on public.features;
create policy features_read on public.features for select to authenticated using (true);
-- Writes: only through the system-admin functions below (or service role).

insert into public.features (key, parent_key, name, description, availability, sort_order) values
  ('attendance',       null,    'Attendance',                 'Check-in / check-out, attendance register and reports', 'free', 10),
  ('leave',            null,    'Leave Management',           'Leave requests, approvals, balances and reports',       'free', 20),
  ('tasks',            null,    'Task Management',            'Task management module',                                'free', 30),
  ('tasks.delegation', 'tasks', 'Delegation',                 'One-time tasks assigned to a person',                   'free', 31),
  ('tasks.checklist',  'tasks', 'Checklist',                  'Recurring tasks at a set frequency',                    'free', 32),
  ('field',            null,    'Field Employee Management',  'Field staff module',                                    'paid', 40),
  ('field.tracking',   'field', 'Field Tracking',             'Duty-time live location, route history and KM',         'paid', 41),
  ('field.visits',     'field', 'Visit Management',           'Customer visits, check-in/out, notes and visit reports','paid', 42),
  ('payroll',          null,    'Payroll',                    'Salary structure, payroll processing and payslips',     'paid', 50)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 2) ORGANIZATION fields: readable ID, account status, time zone, ads override
-- -----------------------------------------------------------------------------
create sequence if not exists public.org_code_seq start 1;

alter table public.companies add column if not exists org_code          text;
alter table public.companies add column if not exists account_status    text not null default 'active';
alter table public.companies add column if not exists suspended_reason  text;
alter table public.companies add column if not exists timezone          text not null default 'Asia/Kolkata';
alter table public.companies add column if not exists ads_enabled       boolean;  -- null = follow plan

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'companies_account_status_check') then
    alter table public.companies add constraint companies_account_status_check
      check (account_status in ('active', 'suspended'));
  end if;
end $$;

-- Backfill ORG codes in registration order (only for rows that have none).
with ordered as (
  select id from public.companies where org_code is null order by created_at nulls last, id
)
update public.companies c
set org_code = 'ORG-' || lpad(nextval('public.org_code_seq')::text, 5, '0')
from ordered o where o.id = c.id;

create unique index if not exists companies_org_code_key on public.companies(org_code);

create or replace function public.companies_assign_org_code() returns trigger
language plpgsql as $$
begin
  if new.org_code is null then
    new.org_code := 'ORG-' || lpad(nextval('public.org_code_seq')::text, 5, '0');
  end if;
  return new;
end $$;

drop trigger if exists companies_assign_org_code on public.companies;
create trigger companies_assign_org_code before insert on public.companies
for each row execute function public.companies_assign_org_code();

-- Organization admins can edit their profile (name, address, logo …) but must
-- never change platform-controlled fields. Silently keep the old values.
create or replace function public.companies_protect_platform_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare j_old jsonb; j_new jsonb; fix jsonb := '{}'::jsonb; c text;
begin
  if public.is_platform_admin() then
    return new;
  end if;
  j_old := to_jsonb(old);
  j_new := to_jsonb(new);
  foreach c in array array['org_code', 'account_status', 'suspended_reason', 'ads_enabled',
                           'plan', 'trial_ends_on', 'price_per_user']
  loop
    if j_old ? c and (j_new->c) is distinct from (j_old->c) then
      fix := fix || jsonb_build_object(c, j_old->c);
    end if;
  end loop;
  if fix <> '{}'::jsonb then
    new := jsonb_populate_record(new, fix);
  end if;
  return new;
end $$;

drop trigger if exists companies_protect_platform_fields on public.companies;
create trigger companies_protect_platform_fields before update on public.companies
for each row execute function public.companies_protect_platform_fields();

-- Plan-level ads default (Phase F will manage it; null = ads on for that plan)
do $$
begin
  if to_regclass('public.subscription_plans') is not null then
    execute 'alter table public.subscription_plans add column if not exists ads_enabled boolean';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3) ORGANIZATION FEATURE OVERRIDES (SystemMaster decisions per organization)
-- -----------------------------------------------------------------------------
create table if not exists public.organization_feature_overrides (
  company_id   uuid not null references public.companies(id) on delete cascade,
  feature_key  text not null references public.features(key) on delete cascade,
  enabled      boolean not null,
  reason       text,
  updated_by   uuid,
  updated_at   timestamptz not null default now(),
  primary key (company_id, feature_key)
);

alter table public.organization_feature_overrides enable row level security;
drop policy if exists org_feature_overrides_read on public.organization_feature_overrides;
create policy org_feature_overrides_read on public.organization_feature_overrides
for select to authenticated
using (company_id = public.my_company_id() or public.is_platform_admin());
-- Writes: only system_admin_set_feature() below.

-- -----------------------------------------------------------------------------
-- 4) AUDIT LOG (administrative changes)
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies(id) on delete set null,
  actor_id    uuid,
  actor_label text,
  action      text not null,
  entity      text not null,
  entity_key  text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_company_time_idx on public.audit_logs(company_id, created_at desc);
create index if not exists audit_logs_time_idx on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
for select to authenticated
using (public.is_platform_admin() or (company_id = public.my_company_id() and public.is_company_admin()));
-- Rows are written only by triggers / definer functions.

create or replace function public.write_audit(
  p_company uuid, p_action text, p_entity text, p_key text, p_old jsonb, p_new jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  if auth.uid() is not null then
    select coalesce(full_name, email) into v_label from public.profiles where id = auth.uid();
  end if;
  insert into public.audit_logs (company_id, actor_id, actor_label, action, entity, entity_key, old_value, new_value)
  values (p_company, auth.uid(),
          coalesce(v_label, case when auth.uid() is null then 'System / SQL' else 'Unknown user' end),
          p_action, p_entity, p_key, p_old, p_new);
end $$;

create or replace function public.audit_feature_overrides() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.write_audit(old.company_id, 'feature_override_removed', 'feature', old.feature_key,
                               jsonb_build_object('enabled', old.enabled), null);
    return old;
  end if;
  if tg_op = 'UPDATE' and new.enabled is not distinct from old.enabled then
    return new;
  end if;
  perform public.write_audit(new.company_id,
    case when tg_op = 'INSERT' then 'feature_override_set' else 'feature_override_changed' end,
    'feature', new.feature_key,
    case when tg_op = 'UPDATE' then jsonb_build_object('enabled', old.enabled) else null end,
    jsonb_build_object('enabled', new.enabled, 'reason', new.reason));
  return new;
end $$;

drop trigger if exists audit_feature_overrides on public.organization_feature_overrides;
create trigger audit_feature_overrides after insert or update or delete on public.organization_feature_overrides
for each row execute function public.audit_feature_overrides();

create or replace function public.audit_company_platform_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb := '{}'::jsonb; n jsonb := '{}'::jsonb; c text; jo jsonb := to_jsonb(old); jn jsonb := to_jsonb(new);
begin
  foreach c in array array['account_status', 'suspended_reason', 'ads_enabled', 'plan', 'trial_ends_on', 'price_per_user']
  loop
    if jo ? c and (jn->c) is distinct from (jo->c) then
      o := o || jsonb_build_object(c, jo->c);
      n := n || jsonb_build_object(c, jn->c);
    end if;
  end loop;
  if n <> '{}'::jsonb then
    perform public.write_audit(new.id, 'organization_updated', 'organization', new.org_code, o, n);
  end if;
  return new;
end $$;

drop trigger if exists audit_company_platform_fields on public.companies;
create trigger audit_company_platform_fields after update on public.companies
for each row execute function public.audit_company_platform_fields();

do $$
begin
  if to_regclass('public.company_subscriptions') is not null then
    execute $f$
      create or replace function public.audit_company_subscriptions() returns trigger
      language plpgsql security definer set search_path = public as $b$
      begin
        perform public.write_audit(
          coalesce((to_jsonb(new)->>'company_id')::uuid, (to_jsonb(old)->>'company_id')::uuid),
          'subscription_' || lower(tg_op), 'subscription', to_jsonb(new)->>'plan_code',
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);
        return coalesce(new, old);
      end $b$;
    $f$;
    execute 'drop trigger if exists audit_company_subscriptions on public.company_subscriptions';
    execute 'create trigger audit_company_subscriptions after insert or update or delete on public.company_subscriptions
             for each row execute function public.audit_company_subscriptions()';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5) ENTITLEMENT RESOLUTION
-- -----------------------------------------------------------------------------
/** The organization's current plan code (null = no plan → free defaults). */
create or replace function public.org_plan_code(p_company uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if to_regclass('public.company_subscriptions') is null then return null; end if;
  execute 'select plan_code::text from public.company_subscriptions where company_id = $1 limit 1'
    into v using p_company;
  return v;
exception when others then
  return null;
end $$;

/** Is one feature (without looking at its parent) enabled for an organization? */
create or replace function public.org_feature_enabled_self(p_company uuid, p_key text, p_plan text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_avail text;
  v_override boolean;
  v_plan boolean;
begin
  select availability into v_avail from public.features where key = p_key;
  if v_avail is null or v_avail = 'disabled' then
    return false;                                   -- unknown key: fail closed
  end if;

  select enabled into v_override from public.organization_feature_overrides
  where company_id = p_company and feature_key = p_key;
  if v_override is not null then
    return v_override;                              -- SystemMaster decision wins (incl. beta access)
  end if;

  if v_avail = 'coming_soon' then
    return false;
  end if;

  if p_plan is not null and to_regclass('public.plan_features') is not null then
    begin
      execute 'select enabled from public.plan_features where plan_code::text = $1 and feature_key = $2 limit 1'
        into v_plan using p_plan, p_key;
    exception when others then
      v_plan := null;
    end;
    if v_plan is not null then
      return v_plan;
    end if;
  end if;

  return v_avail = 'free';
end $$;

/** Full check: organization active + feature + every parent. */
create or replace function public.org_feature_enabled(p_company uuid, p_key text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_status text;
  v_plan   text;
  v_key    text := p_key;
  v_parent text;
  depth    int := 0;
begin
  if p_company is null or p_key is null then return false; end if;

  select account_status into v_status from public.companies where id = p_company;
  if v_status is null or v_status <> 'active' then return false; end if;

  v_plan := public.org_plan_code(p_company);

  while v_key is not null and depth < 5 loop
    if not public.org_feature_enabled_self(p_company, v_key, v_plan) then
      return false;
    end if;
    select parent_key into v_parent from public.features where key = v_key;
    v_key := v_parent;
    depth := depth + 1;
  end loop;
  return true;
end $$;

/** For the signed-in user's organization. */
create or replace function public.has_feature(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.org_feature_enabled(public.my_company_id(), p_key)
$$;

/** Ads: organization override → plan default → on. */
create or replace function public.org_ads_enabled(p_company uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_org boolean; v_plan boolean; v_code text;
begin
  select ads_enabled into v_org from public.companies where id = p_company;
  if v_org is not null then return v_org; end if;
  v_code := public.org_plan_code(p_company);
  if v_code is not null and to_regclass('public.subscription_plans') is not null then
    begin
      execute 'select ads_enabled from public.subscription_plans where code::text = $1 limit 1'
        into v_plan using v_code;
    exception when others then v_plan := null;
    end;
  end if;
  return coalesce(v_plan, true);
end $$;

/** Everything the app needs in one call (used by the web app and, later, the Android app). */
create or replace function public.my_entitlements() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  v_row     public.companies;
  v_feats   jsonb;
begin
  if v_company is null then
    return jsonb_build_object('organization', null, 'features', '{}'::jsonb);
  end if;
  select * into v_row from public.companies where id = v_company;
  select coalesce(jsonb_object_agg(f.key, public.org_feature_enabled(v_company, f.key)), '{}'::jsonb)
    into v_feats from public.features f;
  return jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_row.id, 'org_code', v_row.org_code, 'name', v_row.name,
      'account_status', v_row.account_status, 'timezone', v_row.timezone,
      'suspended_reason', v_row.suspended_reason,
      'plan_code', public.org_plan_code(v_company)),
    'ads_enabled', public.org_ads_enabled(v_company),
    'features', v_feats,
    'catalog', (select coalesce(jsonb_agg(jsonb_build_object(
                  'key', key, 'parent', parent_key, 'name', name, 'availability', availability)
                  order by sort_order), '[]'::jsonb) from public.features)
  );
end $$;

-- -----------------------------------------------------------------------------
-- 6) SYSTEMMASTER CONTROLS (backend for the Phase D panel; usable from SQL now)
-- -----------------------------------------------------------------------------
create or replace function public.system_admin_set_feature(
  p_company uuid, p_key text, p_enabled boolean, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can change organization features';
  end if;
  if not exists (select 1 from public.features where key = p_key) then
    raise exception 'Unknown feature: %', p_key;
  end if;
  if p_enabled is null then
    delete from public.organization_feature_overrides where company_id = p_company and feature_key = p_key;
  else
    insert into public.organization_feature_overrides (company_id, feature_key, enabled, reason, updated_by, updated_at)
    values (p_company, p_key, p_enabled, p_reason, auth.uid(), now())
    on conflict (company_id, feature_key) do update
      set enabled = excluded.enabled, reason = excluded.reason,
          updated_by = excluded.updated_by, updated_at = now();
  end if;
end $$;

create or replace function public.system_admin_set_org_status(
  p_company uuid, p_status text, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can suspend or activate organizations';
  end if;
  update public.companies
  set account_status = p_status,
      suspended_reason = case when p_status = 'suspended' then p_reason else null end
  where id = p_company;
end $$;

create or replace function public.system_admin_set_ads(p_company uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can change ads settings';
  end if;
  update public.companies set ads_enabled = p_enabled where id = p_company;  -- null = follow plan
end $$;

create or replace function public.system_admin_set_feature_availability(p_key text, p_availability text) returns void
language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can change feature availability';
  end if;
  select availability into v_old from public.features where key = p_key;
  update public.features set availability = p_availability, updated_at = now() where key = p_key;
  perform public.write_audit(null, 'feature_availability_changed', 'feature', p_key,
                             jsonb_build_object('availability', v_old),
                             jsonb_build_object('availability', p_availability));
end $$;

-- -----------------------------------------------------------------------------
-- 7) GRANDFATHER existing organizations: every module ON, ads OFF.
--    (Only organizations that exist right now, and only where no decision exists yet.)
-- -----------------------------------------------------------------------------
insert into public.organization_feature_overrides (company_id, feature_key, enabled, reason)
select c.id, f.key, true, 'Existing client — all modules kept at Phase A launch'
from public.companies c
cross join public.features f
where not exists (select 1 from public.organization_feature_overrides o where o.company_id = c.id)
on conflict do nothing;

update public.companies set ads_enabled = false
where ads_enabled is null and created_at < now();

-- -----------------------------------------------------------------------------
-- 8) ENFORCEMENT IN THE DATABASE
--    One RESTRICTIVE policy per module table. Restrictive policies are ANDed
--    with the existing ones, so they can only narrow access, never widen it:
--      · the row must belong to the signed-in user's organization (tenant wall);
--        shared rows with no organization (e.g. default leave types) stay readable
--        but can never be created or changed through the app
--      · the organization must have the module enabled
--    Server jobs and the service key are not affected.
-- -----------------------------------------------------------------------------
create table if not exists public.feature_table_map (
  table_name   text primary key,
  feature_key  text not null references public.features(key),
  parent_table text,   -- for tables without company_id: protect through the parent row
  parent_fk    text
);
alter table public.feature_table_map add column if not exists parent_table text;
alter table public.feature_table_map add column if not exists parent_fk    text;
alter table public.feature_table_map enable row level security;  -- internal

insert into public.feature_table_map (table_name, feature_key, parent_table, parent_fk)
select * from (values
  ('attendance',                   'attendance', null, null),
  ('attendance_daily_log',         'attendance', null, null),
  ('leaves',                       'leave', null, null),
  ('leave_types',                  'leave', null, null),
  ('delegations',                  'tasks.delegation', null, null),
  ('delegation_subtasks',          'tasks.delegation', 'delegations', 'delegation_id'),
  ('checklist_templates',          'tasks.checklist', null, null),
  ('checklist_instances',          'tasks.checklist', null, null),
  ('task_comments',                'tasks', null, null),
  ('task_extensions',              'tasks', null, null),
  ('em_weekly_targets',            'tasks', null, null),
  ('employee_location_history',    'field.tracking', null, null),
  ('employee_live_locations',      'field.tracking', null, null),
  ('tracking_events',              'field.tracking', null, null),
  ('field_visits',                 'field.visits', null, null),
  ('visit_custom_fields',          'field.visits', null, null),
  ('visit_location_history',       'field.visits', null, null),
  ('field_visit_schedule_changes', 'field.visits', null, null),
  ('salary_master',                'payroll', null, null),
  ('payroll_actions',              'payroll', null, null)
) v(table_name, feature_key, parent_table, parent_fk)
on conflict (table_name) do update
  set feature_key = excluded.feature_key, parent_table = excluded.parent_table, parent_fk = excluded.parent_fk;

create table if not exists public.feature_gate_report (
  table_name text primary key, feature_key text, result text, checked_at timestamptz default now()
);
alter table public.feature_gate_report enable row level security;  -- internal

do $$
declare m record; has_company boolean;
begin
  for m in select * from public.feature_table_map loop
    if to_regclass('public.' || m.table_name) is null then
      insert into public.feature_gate_report values (m.table_name, m.feature_key, 'skipped: table not found', now())
      on conflict (table_name) do update set result = excluded.result, checked_at = now();
      continue;
    end if;

    select exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = m.table_name and column_name = 'company_id')
      into has_company;
    if not has_company then
      if m.parent_table is not null and to_regclass('public.' || m.parent_table) is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = m.table_name and column_name = m.parent_fk) then
        -- Visible / writable only when its parent row is (the parent is already gated).
        execute format('alter table public.%I enable row level security', m.table_name);
        execute format('drop policy if exists smhrms_org_feature_gate on public.%I', m.table_name);
        execute format($p$
          create policy smhrms_org_feature_gate on public.%I
          as restrictive for all to public
          using (exists (select 1 from public.%I p where p.id = %I.%I))
          with check (exists (select 1 from public.%I p where p.id = %I.%I))
        $p$, m.table_name, m.parent_table, m.table_name, m.parent_fk, m.parent_table, m.table_name, m.parent_fk);
        insert into public.feature_gate_report values (m.table_name, m.feature_key, 'protected (through ' || m.parent_table || ')', now())
        on conflict (table_name) do update set result = excluded.result, checked_at = now();
      else
        insert into public.feature_gate_report values (m.table_name, m.feature_key, 'skipped: no company_id column', now())
        on conflict (table_name) do update set result = excluded.result, checked_at = now();
      end if;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', m.table_name);
    execute format('drop policy if exists smhrms_org_feature_gate on public.%I', m.table_name);
    execute format($p$
      create policy smhrms_org_feature_gate on public.%I
      as restrictive for all to public
      using ((company_id is null or company_id = (select public.my_company_id()))
             and (select public.has_feature(%L)))
      with check (company_id = (select public.my_company_id()) and (select public.has_feature(%L)))
    $p$, m.table_name, m.feature_key, m.feature_key);

    insert into public.feature_gate_report values (m.table_name, m.feature_key, 'protected', now())
    on conflict (table_name) do update set result = excluded.result, checked_at = now();
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 8b) Phase 2B background jobs now skip organizations without the module.
--     (Same functions as the 2B file, with module checks added. Harmless if
--      Phase 2B has not been installed yet.)
-- -----------------------------------------------------------------------------
create or replace function public.refresh_attendance_log(
  p_date date, p_final boolean default false, p_company uuid default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with emp as (
    select p.id, p.company_id
    from public.profiles p
    where coalesce(p.status, 'active') = 'active'
      and p.company_id is not null
      and (p_company is null or p.company_id = p_company)
      and coalesce(nullif(to_jsonb(p)->>'joined_on', '')::date, p_date) <= p_date
      and public.org_feature_enabled(p.company_id, 'attendance')
  ),
  att as (
    select distinct on (a.employee_id)
      a.employee_id,
      lower(coalesce(to_jsonb(a)->>'status', ''))                       as st,
      coalesce((to_jsonb(a)->>'is_late')::boolean, false)               as late,
      nullif(coalesce(to_jsonb(a)->>'check_in', to_jsonb(a)->>'check_in_at'), '')::timestamptz   as cin,
      nullif(coalesce(to_jsonb(a)->>'check_out', to_jsonb(a)->>'check_out_at'), '')::timestamptz as cout,
      nullif(to_jsonb(a)->>'work_minutes', '')::integer                 as mins
    from public.attendance a
    join emp on emp.id = a.employee_id
    where a.work_date = p_date
    order by a.employee_id, nullif(coalesce(to_jsonb(a)->>'check_in', to_jsonb(a)->>'check_in_at'), '') nulls last
  ),
  lv as (
    select distinct l.employee_id,
           coalesce(nullif(to_jsonb(l)->>'day_type', ''), 'full_day') as day_type
    from public.leaves l
    join emp on emp.id = l.employee_id
    where l.status = 'approved'
      and p_date between l.from_date and coalesce(l.to_date, l.from_date)
  ),
  calc as (
    select
      emp.id as employee_id, emp.company_id,
      att.cin, att.cout, att.mins,
      public.day_off_reason(emp.company_id, emp.id, p_date) as off,
      case
        when att.employee_id is not null and (att.cin is not null or att.st in ('present', 'late', 'half_day'))
          then case
                 when att.st = 'half_day' then 'half_day'
                 when att.late or att.st = 'late' then 'late'
                 else 'present'
               end
        when lv.employee_id is not null then 'on_leave'
        else null
      end as worked_or_leave,
      lv.day_type,
      att.st
    from emp
    left join att on att.employee_id = emp.id
    left join lv  on lv.employee_id  = emp.id
  ),
  final as (
    select employee_id, company_id, cin, cout, mins,
      coalesce(
        worked_or_leave,
        off,
        case when p_final or st = 'absent' then 'absent' else 'pending' end
      ) as status,
      case
        when worked_or_leave is not null and off is not null then 'Worked on ' || replace(off, '_', ' ')
        when worked_or_leave = 'on_leave' and day_type <> 'full_day' then replace(day_type, '_', ' ')
        else null
      end as note
    from calc
  ),
  up as (
    insert into public.attendance_daily_log as t
      (employee_id, work_date, company_id, status, check_in, check_out, work_minutes, note, finalized, updated_at)
    select employee_id, p_date, company_id, status, cin, cout, mins, note, p_final, now()
    from final
    on conflict (employee_id, work_date) do update
      set status       = excluded.status,
          check_in     = excluded.check_in,
          check_out    = excluded.check_out,
          work_minutes = excluded.work_minutes,
          note         = excluded.note,
          finalized    = t.finalized or excluded.finalized,
          updated_at   = now()
    returning 1
  )
  select count(*) into n from up;
  return n;
end $$;

create or replace function public.generate_recurring_tasks(
  p_days_ahead int default 7, p_company uuid default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  t        record;
  occ      date;
  due      date;
  nxt      date;
  anchor   int;
  horizon  date := public.today_ist() + p_days_ahead;
  created  integer := 0;
  guard    int;
  v_time   time;
  v_start  time;
  v_end    time;
begin
  for t in
    select ct.*, coalesce(c.work_start::time, '09:30'::time) as ws, coalesce(c.work_end::time, '18:30'::time) as we
    from public.checklist_templates ct
    join public.companies c on c.id = ct.company_id
    where ct.next_due_date is not null
      and ct.next_due_date <= horizon
      and coalesce((to_jsonb(ct)->>'active')::boolean, true)
      and (p_company is null or ct.company_id = p_company)
      and public.org_feature_enabled(ct.company_id, 'tasks.checklist')
    for update of ct skip locked
  loop
    occ    := t.next_due_date;
    anchor := extract(day from coalesce(t.start_date, t.next_due_date))::int;
    guard  := 0;

    -- keep the due time inside working hours
    v_start := t.ws; v_end := t.we;
    v_time  := coalesce(nullif(to_jsonb(t)->>'due_time', '')::time, v_start);
    if v_end > v_start then
      v_time := greatest(v_start, least(v_time, v_end));
    end if;

    while occ <= horizon and guard < 400 loop
      guard := guard + 1;
      exit when t.end_date is not null and occ > t.end_date;

      -- Occurrences missed for more than 3 days are skipped, not dumped as overdue.
      if occ >= public.today_ist() - 3 then
        due := case when t.frequency = 'daily'
                    then occ   -- daily: simply skip off days (no pile-up on Monday)
                    else public.next_working_day(t.company_id, t.assigned_to, occ) end;

        if public.day_off_reason(t.company_id, t.assigned_to, due) is null
           and (t.end_date is null or due <= t.end_date + 7)
           and not exists (
             select 1 from public.checklist_instances i
             where i.template_id = t.id and i.due_date = due
           )
        then
          insert into public.checklist_instances (company_id, template_id, assigned_to, due_date, due_time)
          values (t.company_id, t.id, t.assigned_to, due, v_time);
          created := created + 1;
        end if;
      end if;

      nxt := case t.frequency
        when 'daily'       then occ + 1
        when 'weekly'      then occ + 7
        when 'monthly'     then public.add_months_anchored(occ, 1, anchor)
        when 'quarterly'   then public.add_months_anchored(occ, 3, anchor)
        when 'half_yearly' then public.add_months_anchored(occ, 6, anchor)
        when 'yearly'      then public.add_months_anchored(occ, 12, anchor)
        else null
      end;
      exit when nxt is null or nxt <= occ;
      occ := nxt;
    end loop;

    update public.checklist_templates set next_due_date = occ where id = t.id;
  end loop;

  return created;
end $$;

create or replace function public.run_reminders() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_now    timestamptz := now();
  v_today  date := public.today_ist();
  v_visits int := 0;
  v_tasks  int := 0;
  v_digest int := 0;
  v_over   int := 0;
begin
  -- 1. Visits starting within 30 minutes
  with due as (
    update public.field_visits v
    set reminder_sent_at = v_now
    where v.scheduled_at > v_now
      and v.scheduled_at <= v_now + interval '30 minutes'
      and v.reminder_sent_at is null
      and v.travel_started_at is null
      and coalesce(v.status, '') not in ('completed', 'cancelled', 'rejected', 'missed')
      and public.org_feature_enabled(v.company_id, 'field.visits')
    returning v.company_id, v.employee_id, v.client_name, v.address, v.scheduled_at
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select company_id, employee_id,
           'Visit in 30 minutes: ' || coalesce(nullif(client_name, ''), 'Client visit'),
           'Planned for ' || to_char(scheduled_at at time zone 'Asia/Kolkata', 'HH12:MI AM')
             || coalesce(' · ' || nullif(address, ''), '') || '. Tap to start travel.',
           'visit_reminder', '/field-visits'
    from due
    returning 1
  ) select count(*) into v_visits from ins;

  -- 2a. Checklist tasks due within 30 minutes
  with due as (
    update public.checklist_instances i
    set reminder_sent_at = v_now
    from public.checklist_templates t
    where t.id = i.template_id
      and i.completed_at is null
      and i.reminder_sent_at is null
      and i.due_date = v_today
      and i.due_time is not null
      and public.org_feature_enabled(i.company_id, 'tasks.checklist')
      and ((i.due_date + i.due_time::time) at time zone 'Asia/Kolkata') > v_now
      and ((i.due_date + i.due_time::time) at time zone 'Asia/Kolkata') <= v_now + interval '30 minutes'
    returning i.company_id, i.assigned_to, t.title, i.due_time
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select company_id, assigned_to, 'Task due soon: ' || title,
           'Due today at ' || to_char(v_today + due_time::time, 'HH12:MI AM') || '.', 'task_reminder', '/tasks'
    from due returning 1
  ) select count(*) into v_tasks from ins;

  -- 2b. Delegations due within 30 minutes
  with due as (
    update public.delegations d
    set reminder_sent_at = v_now
    where d.completed_at is null
      and d.reminder_sent_at is null
      and d.due_date = v_today
      and public.org_feature_enabled(d.company_id, 'tasks.delegation')
      and d.due_time is not null
      and ((d.due_date + d.due_time::time) at time zone 'Asia/Kolkata') > v_now
      and ((d.due_date + d.due_time::time) at time zone 'Asia/Kolkata') <= v_now + interval '30 minutes'
    returning d.company_id, d.assigned_to, d.title, d.due_time
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select company_id, assigned_to, 'Task due soon: ' || title,
           'Due today at ' || to_char(v_today + due_time::time, 'HH12:MI AM') || '.', 'task_reminder', '/tasks'
    from due returning 1
  ) select v_tasks + count(*) into v_tasks from ins;

  -- 3. Morning summary, once a day, when the company's working day starts
  --    (not on holidays / weekly offs / approved leave)
  with emp as (
    select p.id, p.company_id
    from public.profiles p
    join public.companies c on c.id = p.company_id
    where coalesce(p.status, 'active') = 'active'
      and (v_now at time zone 'Asia/Kolkata')::time >= coalesce(c.work_start::time, '09:30'::time)
      and (v_now at time zone 'Asia/Kolkata')::time <  coalesce(c.work_start::time, '09:30'::time) + interval '2 hours'
      and public.day_off_reason(p.company_id, p.id, v_today) is null
      and not exists (select 1 from public.daily_digest_log g where g.employee_id = p.id and g.day = v_today)
      and not exists (select 1 from public.leaves l where l.employee_id = p.id and l.status = 'approved'
                      and v_today between l.from_date and coalesce(l.to_date, l.from_date))
  ), counts as (
    select emp.id, emp.company_id,
      (case when public.org_feature_enabled(emp.company_id, 'tasks.checklist') then
        (select count(*) from public.checklist_instances i
          where i.assigned_to = emp.id and i.due_date = v_today and i.completed_at is null) else 0 end)
      + (case when public.org_feature_enabled(emp.company_id, 'tasks.delegation') then
        (select count(*) from public.delegations d
          where d.assigned_to = emp.id and d.due_date <= v_today and d.completed_at is null) else 0 end) as tasks,
      (case when public.org_feature_enabled(emp.company_id, 'field.visits') then
        (select count(*) from public.field_visits v
          where v.employee_id = emp.id and v.visit_date = v_today
            and coalesce(v.status, '') not in ('completed', 'cancelled', 'rejected')) else 0 end) as visits
    from emp
  ), logged as (
    insert into public.daily_digest_log (employee_id, day)
    select id, v_today from counts where tasks + visits > 0
    on conflict do nothing
    returning employee_id
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select c.company_id, c.id, 'Your plan for today',
           case
             when c.tasks > 0 and c.visits > 0 then
               'You have ' || c.tasks || ' open task' || case when c.tasks = 1 then '' else 's' end
               || ' and ' || c.visits || ' visit' || case when c.visits = 1 then '' else 's' end || ' today.'
             when c.tasks > 0 then
               'You have ' || c.tasks || ' open task' || case when c.tasks = 1 then '' else 's' end || ' today.'
             else
               'You have ' || c.visits || ' visit' || case when c.visits = 1 then '' else 's' end || ' planned today.'
           end,
           'daily_digest', case when c.visits > 0 then '/field-visits' else '/tasks' end
    from counts c join logged l on l.employee_id = c.id
    returning 1
  ) select count(*) into v_digest from ins;

  -- 4. Delegation overdue → tell the person who assigned it (once)
  with od as (
    update public.delegations d
    set overdue_notified_at = v_now
    where d.completed_at is null
      and d.overdue_notified_at is null
      and public.org_feature_enabled(d.company_id, 'tasks.delegation')
      and d.assigned_by is not null
      and d.assigned_by <> d.assigned_to
      and ((d.due_date + coalesce(d.due_time::time, '23:59'::time)) at time zone 'Asia/Kolkata') < v_now
      and d.due_date >= v_today - 7
    returning d.company_id, d.assigned_by, d.assigned_to, d.title
  ), ins as (
    insert into public.notifications (company_id, user_id, title, body, kind, link)
    select od.company_id, od.assigned_by, 'Overdue: ' || od.title,
           coalesce(p.full_name, 'The assignee') || ' has not completed this task yet.',
           'task_overdue', '/tasks'
    from od left join public.profiles p on p.id = od.assigned_to
    returning 1
  ) select count(*) into v_over from ins;

  return jsonb_build_object('visits', v_visits, 'tasks', v_tasks, 'digests', v_digest, 'overdue', v_over);
end $$;

-- -----------------------------------------------------------------------------
-- 9) Permissions
-- -----------------------------------------------------------------------------
revoke all on function public.system_admin_set_feature(uuid, text, boolean, text)       from public, anon;
revoke all on function public.system_admin_set_org_status(uuid, text, text)             from public, anon;
revoke all on function public.system_admin_set_ads(uuid, boolean)                        from public, anon;
revoke all on function public.system_admin_set_feature_availability(text, text)          from public, anon;
revoke all on function public.write_audit(uuid, text, text, text, jsonb, jsonb)          from public, anon, authenticated;
do $$ begin
  -- company-wide jobs stay server-only (they exist only if Phase 2B is installed)
  if to_regprocedure('public.refresh_attendance_log(date, boolean, uuid)') is not null then
    revoke all on function public.refresh_attendance_log(date, boolean, uuid) from public, anon, authenticated;
    revoke all on function public.generate_recurring_tasks(int, uuid)         from public, anon, authenticated;
    revoke all on function public.run_reminders()                              from public, anon, authenticated;
  end if;
end $$;
grant execute on function public.system_admin_set_feature(uuid, text, boolean, text)     to authenticated;
grant execute on function public.system_admin_set_org_status(uuid, text, text)           to authenticated;
grant execute on function public.system_admin_set_ads(uuid, boolean)                      to authenticated;
grant execute on function public.system_admin_set_feature_availability(text, text)        to authenticated;
grant execute on function public.has_feature(text)                    to authenticated;
grant execute on function public.org_feature_enabled(uuid, text)      to authenticated;
grant execute on function public.my_entitlements()                    to authenticated;
grant execute on function public.is_platform_admin()                  to authenticated;

commit;

-- -----------------------------------------------------------------------------
-- RESULT: which tables are now protected (review this list)
-- -----------------------------------------------------------------------------
select table_name, feature_key, result from public.feature_gate_report order by result, table_name;
