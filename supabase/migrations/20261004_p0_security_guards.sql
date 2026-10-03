-- =============================================================================
-- SM HRMS · P0 security guards (Production Audit 2026, Phase 2)
-- 2026-10-04 · ADDITIVE · SAFE TO RE-RUN · NO DATA IS CHANGED OR DELETED
--
-- What this does
--   Adds database-side guards so security does not depend on the browser UI.
--   Every guard applies ONLY to statements sent directly from the browser
--   (PostgREST roles `authenticated` / `anon`). It does NOT affect:
--     * server APIs using the service role,
--     * SECURITY DEFINER RPCs (create_company, field_visit_action_v6,
--       set_employee_status, system_admin_* ...), which run as their owner,
--     * the SQL editor, pg_cron jobs, foreign-key cascades.
--
--   1. profiles        – no self-promotion, no cross-org moves, Owner protected,
--                        only the Owner grants/removes Admin, nobody becomes
--                        Owner by a plain UPDATE, inactive users cannot edit.
--   2. field_visits    – status / lifecycle timestamps change only through the
--                        lifecycle RPC; trusted created_at; Customer Name required.
--   3. leaves          – new requests always start as pending; no overlapping
--                        duplicate requests; only Owner/Admin or the reporting
--                        manager can approve/reject; decided_by/at are trusted.
--   4. support_meetings– an organization can only CANCEL its request; confirm,
--                        reschedule, links and internal notes are SystemMaster-only.
--   5. GPS history     – still immutable for browser users, but no longer blocks
--                        server-side deletion (organization delete, approved
--                        retention). Previously the lock made org deletion fail.
--
-- Rollback (if anything unexpected happens) is at the bottom of this file.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 0) Helpers
-- -----------------------------------------------------------------------------

-- True when the current statement comes straight from the browser API.
-- Inside a SECURITY DEFINER function current_user is the function owner,
-- so trusted RPCs are not affected.
create or replace function public.smhrms_is_browser_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select current_user in ('authenticated', 'anon');
$$;

-- The caller's own profile facts, readable regardless of RLS.
create or replace function public.smhrms_actor()
returns table (user_id uuid, company_id uuid, role text, status text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.company_id, p.role::text, coalesce(p.status::text, 'active')
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.smhrms_actor() from public, anon;
grant execute on function public.smhrms_actor() to authenticated;
grant execute on function public.smhrms_is_browser_role() to authenticated, anon;

-- Compatibility for older onboarding code that sets the new owner's
-- company_id with a plain UPDATE: allowed only for the company this user owns,
-- or a company created moments ago that has no members yet.
create or replace function public.smhrms_can_claim_new_company(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company
      and (c.owner_id = auth.uid()
           or (c.created_at > now() - interval '15 minutes'
               and not exists (select 1 from public.profiles m where m.company_id = c.id)))
  );
$$;

revoke all on function public.smhrms_can_claim_new_company(uuid) from public, anon;
grant execute on function public.smhrms_can_claim_new_company(uuid) to authenticated;

-- Reporting managers of an employee (bypasses RLS; returns ids only).
create or replace function public.smhrms_employee_managers(p_employee uuid)
returns table (manager_id uuid, work_manager_id uuid, field_manager_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.manager_id, p.work_manager_id, p.field_manager_id
  from public.profiles p
  where p.id = p_employee
    and p.company_id = (select company_id from public.profiles where id = auth.uid());
$$;

revoke all on function public.smhrms_employee_managers(uuid) from public, anon;
grant execute on function public.smhrms_employee_managers(uuid) to authenticated;

-- Keys whose value differs between two row images (column-agnostic, so the
-- guard keeps working if columns are added later).
create or replace function public.smhrms_changed_keys(o jsonb, n jsonb)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(k), '{}')
  from (
    select key as k from jsonb_object_keys(coalesce(n, '{}'::jsonb)) as key
    where (o -> key) is distinct from (n -> key)
  ) x;
$$;

-- -----------------------------------------------------------------------------
-- 1) profiles privilege guard
-- -----------------------------------------------------------------------------
create or replace function public.smhrms_profiles_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  a record;
  changed text[];
  -- Organization-structure fields only Owner/Admin may set.
  admin_only text[] := array[
    'role','status','left_at','employee_code','manager_id','work_manager_id',
    'field_manager_id','access_permissions','branch_id','department','designation',
    'photo_required','auto_attendance','auto_in_time','auto_out_time',
    'weekly_off_days','joined_on','employee_type'];
  -- Fields of the Owner's record nobody else may touch.
  owner_protected text[] := array['role','status','left_at','email','phone','access_permissions','company_id'];
  -- Fields an Admin may not change on another Admin.
  admin_protected text[] := array['role','status','left_at','email','access_permissions'];
  is_self boolean;
  is_org_admin boolean;
  is_their_manager boolean;
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;

  select * into a from public.smhrms_actor();
  if a.user_id is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- A browser may only create its own blank profile (normally the signup
    -- trigger does this server-side).
    if new.id is distinct from auth.uid()
       or new.company_id is not null
       or coalesce(new.role::text, 'employee') in ('owner', 'admin', 'manager') then
      raise exception 'You do not have permission to create this profile.' using errcode = '42501';
    end if;
    return new;
  end if;

  if a.status <> 'active' then
    raise exception 'Your account is not active.' using errcode = '42501';
  end if;

  changed := public.smhrms_changed_keys(to_jsonb(old), to_jsonb(new));
  if coalesce(array_length(changed, 1), 0) = 0 then
    return new;
  end if;

  -- coalesce(): a NULL here must mean "no", never "unknown".
  is_self := coalesce(new.id = a.user_id, false);
  is_org_admin := coalesce(a.role in ('owner', 'admin') and a.company_id = old.company_id, false);
  is_their_manager := coalesce(a.company_id = old.company_id
                  and a.user_id in (old.manager_id, old.work_manager_id, old.field_manager_id), false);

  -- Organization membership never changes through a plain UPDATE, except the
  -- very first assignment of a brand-new owner to the company they own
  -- (compatibility with older onboarding code).
  if 'company_id' = any(changed) then
    if not (is_self and old.company_id is null
            and public.smhrms_can_claim_new_company(new.company_id)) then
      raise exception 'Organization membership cannot be changed here.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Login email is managed only by the server (it must match the login account).
  if 'email' = any(changed) then
    raise exception 'Login email can only be changed by an Owner/Admin from Team > Edit.' using errcode = '42501';
  end if;

  -- Ownership never moves through a plain UPDATE.
  if 'role' = any(changed) and (new.role::text = 'owner' or old.role::text = 'owner') then
    raise exception 'Ownership can only be moved with Transfer Ownership.' using errcode = '42501';
  end if;

  -- The Owner's record is protected from everyone but the Owner.
  if old.role::text = 'owner' and not is_self and changed && owner_protected then
    raise exception 'Only the Organization Owner can change these details.' using errcode = '42501';
  end if;

  -- Only the Owner grants or removes Admin.
  if 'role' = any(changed) and (new.role::text = 'admin' or old.role::text = 'admin')
     and a.role <> 'owner' then
    raise exception 'Only the Organization Owner can grant or remove the Admin role.' using errcode = '42501';
  end if;

  -- Admins cannot change another Admin's role/status/access.
  if old.role::text = 'admin' and not is_self and a.role <> 'owner' and changed && admin_protected then
    raise exception 'Only the Organization Owner can change another Admin.' using errcode = '42501';
  end if;

  -- Organization-structure fields: Owner/Admin of the same organization only,
  -- and nobody changes their own role/status/access.
  if changed && admin_only then
    if not is_org_admin then
      raise exception 'Only an Owner/Admin can change these employee settings.' using errcode = '42501';
    end if;
    if is_self and changed && array['role','status','left_at','access_permissions'] then
      raise exception 'You cannot change your own role, status or access.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Personal fields (name, phone, address, bank, emergency contact, photo ...):
  -- the person themself, an Owner/Admin of the organization, or their manager.
  if not (is_self or is_org_admin or is_their_manager) then
    raise exception 'You do not have permission to edit this employee.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists smhrms_profiles_guard on public.profiles;
create trigger smhrms_profiles_guard
before insert or update on public.profiles
for each row execute function public.smhrms_profiles_guard();

-- -----------------------------------------------------------------------------
-- 2) field_visits lifecycle guard
-- -----------------------------------------------------------------------------
create or replace function public.smhrms_field_visits_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  lifecycle text[] := array[
    'status','accepted_at','travel_started_at','reached_at','check_in_at',
    'meeting_started_at','completed_at','check_out_at','check_in_lat','check_in_lng',
    'person_met','outcome','completion_notes','created_at'];
  changed text[];
  n jsonb;
  fix jsonb := '{}'::jsonb;
  k text;
begin
  -- Customer Name is mandatory for every new visit (all callers).
  if tg_op = 'INSERT' and nullif(btrim(coalesce(new.client_name, '')), '') is null then
    raise exception 'Customer name is required.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.client_name is distinct from old.client_name
     and nullif(btrim(coalesce(new.client_name, '')), '') is null then
    raise exception 'Customer name is required.' using errcode = '23514';
  end if;

  if not public.smhrms_is_browser_role() then
    return new;
  end if;

  n := to_jsonb(new);

  if tg_op = 'INSERT' then
    -- New visits always start at the beginning of the lifecycle, with a
    -- server timestamp.
    if coalesce(new.status, 'planned') not in ('planned', 'assigned') then
      raise exception 'A new visit must start as Planned or Assigned.' using errcode = '23514';
    end if;
    foreach k in array lifecycle loop
      if k not in ('status', 'created_at') and n ? k and (n ->> k) is not null then
        fix := fix || jsonb_build_object(k, null);
      end if;
    end loop;
    if n ? 'created_at' then
      fix := fix || jsonb_build_object('created_at', now());
    end if;
    if fix <> '{}'::jsonb then
      new := jsonb_populate_record(new, fix);
    end if;
    return new;
  end if;

  changed := public.smhrms_changed_keys(to_jsonb(old), n);
  if changed && lifecycle then
    raise exception 'This visit cannot be moved to that status from here. Refresh and use the visit buttons.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.field_visits') is not null then
    execute 'drop trigger if exists smhrms_field_visits_guard on public.field_visits';
    execute 'create trigger smhrms_field_visits_guard before insert or update on public.field_visits
             for each row execute function public.smhrms_field_visits_guard()';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3) leaves guard
-- -----------------------------------------------------------------------------
create or replace function public.smhrms_leaves_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  a record;
  emp record;
  changed text[];
  o_to date;
  n_to date;
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;

  select * into a from public.smhrms_actor();
  if a.user_id is null or a.status <> 'active' then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.company_id is distinct from a.company_id then
      raise exception 'Leave must belong to your organization.' using errcode = '42501';
    end if;
    if new.employee_id is distinct from a.user_id and a.role not in ('owner', 'admin') then
      raise exception 'You can apply leave only for yourself.' using errcode = '42501';
    end if;
    -- Every new request starts pending; decisions come later from an approver.
    new.status := 'pending';
    new.decided_by := null;
    new.decided_at := null;

    n_to := coalesce(new.to_date, new.from_date);
    if n_to < new.from_date then
      raise exception 'Leave end date cannot be before the start date.' using errcode = '23514';
    end if;
    -- No overlapping active requests. Two different half days on the same
    -- date (first_half + second_half) are allowed.
    if exists (
      select 1 from public.leaves l
      where l.employee_id = new.employee_id
        and coalesce(l.status, 'pending') in ('pending', 'approved')
        and daterange(l.from_date, coalesce(l.to_date, l.from_date), '[]')
            && daterange(new.from_date, n_to, '[]')
        and not (
          l.from_date = coalesce(l.to_date, l.from_date)
          and new.from_date = n_to
          and coalesce(l.day_type, '') in ('first_half', 'second_half')
          and coalesce(new.day_type, '') in ('first_half', 'second_half')
          and l.day_type is distinct from new.day_type
        )
    ) then
      raise exception 'You already have a leave request for these dates.' using errcode = '23505';
    end if;
    return new;
  end if;

  -- UPDATE
  changed := public.smhrms_changed_keys(to_jsonb(old), to_jsonb(new));
  if 'company_id' = any(changed) or 'employee_id' = any(changed) then
    raise exception 'This leave request cannot be moved.' using errcode = '42501';
  end if;

  if 'status' = any(changed) or 'decided_by' = any(changed) or 'decided_at' = any(changed) then
    select * into emp from public.smhrms_employee_managers(old.employee_id);

    if new.status::text = 'cancelled' and coalesce(old.employee_id = a.user_id, false) then
      null; -- employees may withdraw their own request
    elsif coalesce(a.company_id = old.company_id
          and (a.role in ('owner', 'admin')
               or a.user_id in (emp.manager_id, emp.work_manager_id, emp.field_manager_id)), false) then
      if old.employee_id = a.user_id and a.role not in ('owner', 'admin') then
        raise exception 'You cannot approve your own leave.' using errcode = '42501';
      end if;
    else
      raise exception 'Only an Owner/Admin or the reporting manager can decide this leave.' using errcode = '42501';
    end if;

    -- Decision metadata always comes from the server.
    if new.status::text in ('approved', 'rejected') then
      new.decided_by := a.user_id;
      new.decided_at := now();
    end if;
  end if;

  if 'buddy_status' = any(changed)
     and not coalesce(old.buddy_id = a.user_id or (a.role in ('owner', 'admin') and a.company_id = old.company_id), false) then
    raise exception 'Only the nominated buddy can respond to this request.' using errcode = '42501';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.leaves') is not null then
    execute 'drop trigger if exists smhrms_leaves_guard on public.leaves';
    execute 'create trigger smhrms_leaves_guard before insert or update on public.leaves
             for each row execute function public.smhrms_leaves_guard()';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4) support_meetings – organizations may only cancel their own request
-- -----------------------------------------------------------------------------
create or replace function public.smhrms_support_meetings_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  changed text[];
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;
  if coalesce(public.is_platform_admin(), false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'requested';
    new.meeting_url := null;
    new.internal_notes := null;
    new.host_user_id := null;
    return new;
  end if;

  changed := public.smhrms_changed_keys(to_jsonb(old), to_jsonb(new));
  changed := array(select x from unnest(changed) x where x <> 'updated_at');
  if coalesce(array_length(changed, 1), 0) = 0 then
    return new;
  end if;
  if changed <@ array['status'] and new.status = 'cancelled'
     and old.status in ('requested', 'confirmed', 'rescheduled') then
    return new;
  end if;
  raise exception 'Only SystemMaster support can confirm or change a meeting. You can cancel your request.'
    using errcode = '42501';
end;
$$;

do $$
begin
  if to_regclass('public.support_meetings') is not null then
    execute 'drop trigger if exists smhrms_support_meetings_guard on public.support_meetings';
    execute 'create trigger smhrms_support_meetings_guard before insert or update on public.support_meetings
             for each row execute function public.smhrms_support_meetings_guard()';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5) GPS history: immutable for browser users, deletable by the server
-- -----------------------------------------------------------------------------
create or replace function public.smhrms_lock_location_history()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.smhrms_is_browser_role() then
    raise exception 'Recorded location history is immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.smhrms_lock_tracking_events()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.smhrms_is_browser_role() then
    raise exception 'Recorded tracking events are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

commit;

-- =============================================================================
-- ROLLBACK (only if a guard blocks a legitimate workflow — then report it):
--
--   drop trigger if exists smhrms_profiles_guard on public.profiles;
--   drop trigger if exists smhrms_field_visits_guard on public.field_visits;
--   drop trigger if exists smhrms_leaves_guard on public.leaves;
--   drop trigger if exists smhrms_support_meetings_guard on public.support_meetings;
--
-- Each guard can be removed independently. No data needs to be restored.
-- =============================================================================
