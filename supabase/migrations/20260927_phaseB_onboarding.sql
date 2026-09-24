-- =============================================================================
-- SM HRMS · Phase B · New organization registration + module selection
--
-- Run ONCE in Supabase → SQL Editor AFTER Phase A, BEFORE uploading the
-- Phase B code. Safe to re-run. Additive only: nothing is dropped or deleted.
--
-- Rules
--   · FREE modules  → the organization can switch them on/off itself.
--   · PAID modules  → selecting one creates an activation REQUEST for
--                     SystemMaster (Phase D panel / SQL below). No self-upgrade.
--   · SystemMaster decisions (source = 'platform') can never be changed by
--     the organization.
--   · Existing clients (source = 'grandfathered') may switch their modules
--     on and off freely — they keep what they had.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Who made each module decision
-- -----------------------------------------------------------------------------
alter table public.organization_feature_overrides
  add column if not exists source text not null default 'platform';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'org_feature_overrides_source_check') then
    alter table public.organization_feature_overrides add constraint org_feature_overrides_source_check
      check (source in ('platform', 'organization', 'grandfathered'));
  end if;
end $$;

update public.organization_feature_overrides
set source = 'grandfathered'
where source = 'platform' and reason like 'Existing client%';

-- SystemMaster changes are always marked 'platform'
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
    insert into public.organization_feature_overrides (company_id, feature_key, enabled, reason, updated_by, updated_at, source)
    values (p_company, p_key, p_enabled, p_reason, auth.uid(), now(), 'platform')
    on conflict (company_id, feature_key) do update
      set enabled = excluded.enabled, reason = excluded.reason,
          updated_by = excluded.updated_by, updated_at = now(), source = 'platform';
  end if;
  -- An approval closes any open request for the same module
  if p_enabled is true then
    update public.organization_module_requests
    set status = 'approved', decided_by = auth.uid(), decided_at = now(),
        decision_note = coalesce(p_reason, decision_note)
    where company_id = p_company and feature_key = p_key and status = 'pending';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2) Module activation requests (paid modules chosen by an organization)
-- -----------------------------------------------------------------------------
create table if not exists public.organization_module_requests (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  feature_key   text not null references public.features(key) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'declined', 'cancelled')),
  note          text,
  requested_by  uuid,
  requested_at  timestamptz not null default now(),
  decided_by    uuid,
  decided_at    timestamptz,
  decision_note text
);

create unique index if not exists org_module_requests_one_pending
  on public.organization_module_requests(company_id, feature_key) where status = 'pending';
create index if not exists org_module_requests_status_idx
  on public.organization_module_requests(status, requested_at desc);

alter table public.organization_module_requests enable row level security;
drop policy if exists org_module_requests_read on public.organization_module_requests;
create policy org_module_requests_read on public.organization_module_requests
for select to authenticated
using (public.is_platform_admin() or (company_id = public.my_company_id() and public.is_company_admin()));
-- Writes only through the functions below.

create or replace function public.audit_module_requests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(new.company_id, 'module_requested', 'feature', new.feature_key, null,
                               jsonb_build_object('status', new.status, 'note', new.note));
  elsif new.status is distinct from old.status then
    perform public.write_audit(new.company_id, 'module_request_' || new.status, 'feature', new.feature_key,
                               jsonb_build_object('status', old.status),
                               jsonb_build_object('status', new.status, 'note', new.decision_note));
  end if;
  return new;
end $$;

drop trigger if exists audit_module_requests on public.organization_module_requests;
create trigger audit_module_requests after insert or update on public.organization_module_requests
for each row execute function public.audit_module_requests();

-- -----------------------------------------------------------------------------
-- 3) Organization profile fields collected at registration
-- -----------------------------------------------------------------------------
alter table public.companies add column if not exists address                 text;
alter table public.companies add column if not exists state                   text;
alter table public.companies add column if not exists pincode                 text;
alter table public.companies add column if not exists email                   text;
alter table public.companies add column if not exists onboarding_completed_at timestamptz;

-- Organizations that already exist have finished registration long ago.
update public.companies set onboarding_completed_at = coalesce(created_at, now())
where onboarding_completed_at is null and created_at < now() - interval '1 hour';

-- -----------------------------------------------------------------------------
-- 4) Module selection by the organization's owner / admin
--    p_modules = every key the organization wants, e.g.
--    {attendance, leave, tasks, tasks.delegation, field, field.visits}
-- -----------------------------------------------------------------------------
create or replace function public.org_set_modules(p_modules text[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_company  uuid := public.my_company_id();
  v_plan     text;
  f          record;
  v_row      public.organization_feature_overrides;
  v_want     boolean;
  v_enabled  text[] := '{}';
  v_disabled text[] := '{}';
  v_requested text[] := '{}';
  v_locked   text[] := '{}';
begin
  if v_company is null or not public.is_company_admin() then
    raise exception 'Only the organization owner or an admin can choose modules';
  end if;
  v_plan := public.org_plan_code(v_company);

  for f in select * from public.features where availability <> 'disabled' order by sort_order loop
    -- A parent is wanted if it, or any of its sub-features, is selected.
    v_want := f.key = any(p_modules)
              or exists (select 1 from public.features c where c.parent_key = f.key and c.key = any(p_modules));

    select * into v_row from public.organization_feature_overrides
    where company_id = v_company and feature_key = f.key;

    -- SystemMaster decision: the organization cannot change it.
    if v_row.source = 'platform' then
      if v_want is distinct from v_row.enabled then v_locked := v_locked || f.key; end if;
      continue;
    end if;

    -- Existing client: keeps what it had, may switch freely.
    if v_row.source = 'grandfathered' then
      if v_row.enabled is distinct from v_want then
        update public.organization_feature_overrides
        set enabled = v_want, updated_by = auth.uid(), updated_at = now(),
            reason = case when v_want then 'Re-enabled by organization' else 'Switched off by organization' end
        where company_id = v_company and feature_key = f.key;
      end if;
      if v_want then v_enabled := v_enabled || f.key; else v_disabled := v_disabled || f.key; end if;
      continue;
    end if;

    if not v_want then
      insert into public.organization_feature_overrides (company_id, feature_key, enabled, reason, updated_by, source)
      values (v_company, f.key, false, 'Not selected by organization', auth.uid(), 'organization')
      on conflict (company_id, feature_key) do update
        set enabled = false, reason = excluded.reason, updated_by = excluded.updated_by,
            updated_at = now(), source = 'organization';
      -- withdraw an open request for a module that is no longer wanted
      update public.organization_module_requests set status = 'cancelled', decided_at = now()
      where company_id = v_company and feature_key = f.key and status = 'pending';
      v_disabled := v_disabled || f.key;
      continue;
    end if;

    -- Wanted: remove the organization's own "off" switch, then check entitlement.
    delete from public.organization_feature_overrides
    where company_id = v_company and feature_key = f.key and source = 'organization';

    if public.org_feature_enabled_self(v_company, f.key, v_plan) then
      v_enabled := v_enabled || f.key;
    elsif f.availability = 'coming_soon' then
      v_locked := v_locked || f.key;
    else
      insert into public.organization_module_requests (company_id, feature_key, note, requested_by)
      values (v_company, f.key, 'Selected by the organization', auth.uid())
      on conflict do nothing;
      v_requested := v_requested || f.key;
    end if;
  end loop;

  return jsonb_build_object('enabled', v_enabled, 'disabled', v_disabled,
                            'requested', v_requested, 'locked', v_locked);
end $$;

/** Request one paid module (Settings → Plan & Features → Request). */
create or replace function public.org_request_module(p_key text, p_note text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare v_company uuid := public.my_company_id();
begin
  if v_company is null or not public.is_company_admin() then
    raise exception 'Only the organization owner or an admin can request modules';
  end if;
  if not exists (select 1 from public.features where key = p_key and availability in ('free', 'paid')) then
    raise exception 'This module cannot be requested right now';
  end if;
  if public.org_feature_enabled(v_company, p_key) then
    return 'already_active';
  end if;
  insert into public.organization_module_requests (company_id, feature_key, note, requested_by)
  values (v_company, p_key, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  on conflict do nothing;
  return 'requested';
end $$;

-- -----------------------------------------------------------------------------
-- 5) Complete registration: profile + organization details + modules
-- -----------------------------------------------------------------------------
create or replace function public.complete_organization_setup(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  v_tz      text := nullif(trim(p->>'timezone'), '');
  v_result  jsonb;
  v_code    text;
  arr       text[];
begin
  if v_company is null or not public.is_company_admin() then
    raise exception 'Organization not found for this account';
  end if;
  if v_tz is not null and not exists (select 1 from pg_timezone_names where name = v_tz) then
    raise exception 'Unknown time zone: %', v_tz;
  end if;

  update public.companies set
    industry = coalesce(nullif(trim(p->>'industry'), ''), industry),
    size     = coalesce(nullif(trim(p->>'size'), ''), size),
    phone    = coalesce(nullif(trim(p->>'phone'), ''), phone),
    email    = coalesce(nullif(lower(trim(p->>'email')), ''), email),
    address  = coalesce(nullif(trim(p->>'address'), ''), address),
    city     = coalesce(nullif(trim(p->>'city'), ''), city),
    state    = coalesce(nullif(trim(p->>'state'), ''), state),
    pincode  = coalesce(nullif(trim(p->>'pincode'), ''), pincode),
    timezone = coalesce(v_tz, timezone),
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_company;

  update public.profiles set
    full_name = coalesce(nullif(trim(p->>'admin_name'), ''), full_name),
    phone     = coalesce(nullif(trim(p->>'phone'), ''), phone)
  where id = auth.uid();

  if jsonb_typeof(p->'modules') = 'array' then
    select array_agg(x) into arr from jsonb_array_elements_text(p->'modules') x;
    v_result := public.org_set_modules(coalesce(arr, '{}'));
  end if;

  select org_code into v_code from public.companies where id = v_company;
  perform public.write_audit(v_company, 'organization_registered', 'organization', v_code, null,
                             jsonb_build_object('modules', p->'modules', 'timezone', v_tz));

  return jsonb_build_object('org_code', v_code, 'modules', v_result);
end $$;

-- -----------------------------------------------------------------------------
-- 6) SystemMaster: approve / decline a request
-- -----------------------------------------------------------------------------
create or replace function public.system_admin_decide_module_request(
  p_request uuid, p_approve boolean, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare r public.organization_module_requests;
begin
  if not public.is_platform_admin() then
    raise exception 'Only SystemMaster administrators can decide module requests';
  end if;
  select * into r from public.organization_module_requests where id = p_request;
  if r.id is null or r.status <> 'pending' then
    raise exception 'Request not found or already decided';
  end if;
  if p_approve then
    perform public.system_admin_set_feature(r.company_id, r.feature_key, true,
                                            coalesce(p_note, 'Module request approved'));
  else
    update public.organization_module_requests
    set status = 'declined', decided_by = auth.uid(), decided_at = now(), decision_note = p_note
    where id = p_request;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7) Entitlements now also report open requests + registration status
-- -----------------------------------------------------------------------------
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
      'onboarding_completed_at', v_row.onboarding_completed_at,
      'plan_code', public.org_plan_code(v_company)),
    'ads_enabled', public.org_ads_enabled(v_company),
    'features', v_feats,
    'locked', (select coalesce(jsonb_agg(feature_key), '[]'::jsonb)
               from public.organization_feature_overrides
               where company_id = v_company and source = 'platform'),
    'requests', (select coalesce(jsonb_agg(feature_key), '[]'::jsonb)
                 from public.organization_module_requests
                 where company_id = v_company and status = 'pending'),
    'catalog', (select coalesce(jsonb_agg(jsonb_build_object(
                  'key', key, 'parent', parent_key, 'name', name, 'availability', availability)
                  order by sort_order), '[]'::jsonb) from public.features)
  );
end $$;

-- -----------------------------------------------------------------------------
-- 8) Permissions
-- -----------------------------------------------------------------------------
revoke all on function public.org_set_modules(text[])                          from public, anon;
revoke all on function public.org_request_module(text, text)                   from public, anon;
revoke all on function public.complete_organization_setup(jsonb)               from public, anon;
revoke all on function public.system_admin_decide_module_request(uuid, boolean, text) from public, anon;
grant execute on function public.org_set_modules(text[])                       to authenticated;
grant execute on function public.org_request_module(text, text)                to authenticated;
grant execute on function public.complete_organization_setup(jsonb)            to authenticated;
grant execute on function public.system_admin_decide_module_request(uuid, boolean, text) to authenticated;

commit;

-- Check: pending module requests (SystemMaster)
select c.org_code, c.name, r.feature_key, r.status, r.requested_at
from public.organization_module_requests r join public.companies c on c.id = r.company_id
order by r.requested_at desc limit 20;
