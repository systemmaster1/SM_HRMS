-- =============================================================================
-- SM HRMS · Phase 3 · Core reliability (attendance, leave, tasks, field visits)
-- 2026-10-06 · ADDITIVE · SAFE TO RE-RUN · NO DATA IS CHANGED OR DELETED
--
-- 1. Attendance IN/OUT: disabled / removed employees and suspended
--    organizations can no longer punch through the API.
-- 2. Night shifts: Attendance OUT after midnight now closes the open duty
--    from the previous evening (before: "You have not checked in today" and
--    the employee stayed "on duty" with GPS tracking running). Duty status
--    used by tracking follows the open duty, not the calendar date.
-- 3. Leave: number of days is calculated by the server from the dates and
--    day type (full day = calendar days, half day = 0.5, short leave/WFH = 0),
--    the same rule the app shows.
-- 4. Tasks (delegations): the assignee can only mark a task done / change
--    its status; due date, title, assignee and reopening stay with the person
--    who assigned it or an Owner/Admin. assigned_by is always the real sender.
-- 5. Field visits: proper Cancel with a reason (field_visit_cancel_v1).
-- =============================================================================
begin;

-- 1 + 2) attendance RPCs ------------------------------------------------------
do $$
declare
  def text;
  newdef text;
  status_check text := E'select * into v_prof from public.profiles where id = uid;\n'
    || E'  -- smhrms-active-check: removed/disabled employees and suspended organizations cannot punch\n'
    || E'  if v_prof.id is null or coalesce(v_prof.status, ''active'') <> ''active'' then\n'
    || E'    raise exception ''Your account is not active. Please contact your administrator.'';\n'
    || E'  end if;\n'
    || E'  if exists (select 1 from public.companies sc where sc.id = v_prof.company_id and sc.account_status = ''suspended'') then\n'
    || E'    raise exception ''Your organization is suspended. Please contact your administrator.'';\n'
    || E'  end if;';
begin
  -- check_in
  if to_regprocedure('public.check_in(double precision,double precision,text,text,text)') is not null then
    def := pg_get_functiondef('public.check_in(double precision,double precision,text,text,text)'::regprocedure);
    if position('smhrms-active-check' in def) = 0 then
      newdef := replace(def, 'select * into v_prof from public.profiles where id = uid;', status_check);
      if newdef <> def then execute newdef; end if;
    end if;
  end if;

  -- check_out: status check + close the latest open duty (night shift)
  if to_regprocedure('public.check_out(double precision,double precision,text,text,text)') is not null then
    def := pg_get_functiondef('public.check_out(double precision,double precision,text,text,text)'::regprocedure);
    newdef := def;
    if position('smhrms-active-check' in newdef) = 0 then
      newdef := replace(newdef, 'select * into v_prof from public.profiles where id = uid;', status_check);
    end if;
    if position('smhrms-open-duty' in newdef) = 0 then
      newdef := regexp_replace(newdef,
        E'select \\* into rec\\s+from public\\.attendance\\s+where employee_id = uid and work_date = v_today;',
        E'-- smhrms-open-duty: close the most recent open duty (also after midnight)\n'
        || E'  select * into rec from public.attendance\n'
        || E'  where employee_id = uid and check_in is not null and check_out is null\n'
        || E'    and check_in > v_now - interval ''20 hours''\n'
        || E'  order by check_in desc limit 1;\n'
        || E'  if rec.id is null then\n'
        || E'    select * into rec from public.attendance where employee_id = uid and work_date = v_today;\n'
        || E'  end if;');
    end if;
    if newdef <> def then execute newdef; end if;
  end if;
end $$;

-- Duty status for tracking: an open Attendance IN within the last 20 hours,
-- visible only inside the caller's organization.
create or replace function public.is_employee_on_duty_v7(p_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.attendance a
    where a.employee_id = p_employee_id
      and a.company_id = (select company_id from public.profiles where id = p_employee_id)
      and (auth.uid() is null
           or a.company_id = (select company_id from public.profiles where id = auth.uid()))
      and a.check_in is not null
      and a.check_out is null
      and a.check_in > now() - interval '20 hours'
  );
$$;
revoke execute on function public.is_employee_on_duty_v7(uuid) from public, anon;
grant execute on function public.is_employee_on_duty_v7(uuid) to authenticated, service_role;

-- 3) leave days computed by the server ----------------------------------------
create or replace function public.smhrms_leave_days(p_from date, p_to date, p_day_type text)
returns numeric language sql immutable set search_path = public as $$
  select case coalesce(p_day_type, 'full_day')
           when 'full_day' then greatest(1, (coalesce(p_to, p_from) - p_from) + 1)::numeric
           when 'first_half' then 0.5
           when 'second_half' then 0.5
           else 0
         end;
$$;

create or replace function public.smhrms_leaves_days_trigger()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;
  if new.day_type is distinct from 'full_day' and new.day_type is not null then
    new.to_date := new.from_date;   -- half day / short leave / WFH are single-day
  end if;
  if tg_op = 'INSERT'
     or new.from_date is distinct from old.from_date
     or new.to_date is distinct from old.to_date
     or new.day_type is distinct from old.day_type
     or new.days is distinct from old.days then
    new.days := public.smhrms_leave_days(new.from_date, new.to_date, new.day_type);
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.leaves') is not null then
    execute 'drop trigger if exists smhrms_leaves_days on public.leaves';
    execute 'create trigger smhrms_leaves_days before insert or update on public.leaves
             for each row execute function public.smhrms_leaves_days_trigger()';
  end if;
end $$;

-- 4) tasks (delegations) guard -------------------------------------------------
-- (also defined by 2b4; repeated here so this migration stands on its own)
create or replace function public.smhrms_same_org_member(p_user uuid, p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.company_id = p_company);
$$;
revoke all on function public.smhrms_same_org_member(uuid, uuid) from public, anon;
grant execute on function public.smhrms_same_org_member(uuid, uuid) to authenticated;

create or replace function public.smhrms_delegations_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  a record;
  changed text[];
  is_admin boolean;
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;
  select * into a from public.smhrms_actor();
  if a.user_id is null or a.status <> 'active' then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  is_admin := coalesce(a.role in ('owner', 'admin') and a.company_id = coalesce(old.company_id, new.company_id), false);

  if tg_op = 'INSERT' then
    if new.company_id is distinct from a.company_id then
      raise exception 'Task must belong to your organization.' using errcode = '42501';
    end if;
    if new.assigned_to is null or not public.smhrms_same_org_member(new.assigned_to, a.company_id) then
      raise exception 'Choose an employee of your organization.' using errcode = '42501';
    end if;
    new.assigned_by := a.user_id;     -- the real sender, never someone else
    new.completed_at := null;
    return new;
  end if;

  changed := public.smhrms_changed_keys(to_jsonb(old), to_jsonb(new));
  if coalesce(array_length(changed, 1), 0) = 0 then
    return new;
  end if;
  if 'company_id' = any(changed) or 'id' = any(changed) then
    raise exception 'This task cannot be moved to another organization.' using errcode = '42501';
  end if;
  if 'assigned_by' = any(changed) and not is_admin then
    raise exception 'The task sender cannot be changed.' using errcode = '42501';
  end if;

  if is_admin or old.assigned_by = a.user_id then
    if 'assigned_to' = any(changed)
       and not public.smhrms_same_org_member(new.assigned_to, old.company_id) then
      raise exception 'Choose an employee of your organization.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.assigned_to = a.user_id then
    if not (changed <@ array['status', 'completed_at']) then
      raise exception 'You can update only the progress of a task assigned to you. Ask the sender to change the due date or details.'
        using errcode = '42501';
    end if;
    if old.completed_at is not null and new.completed_at is null then
      raise exception 'Only the person who assigned the task can re-open it.' using errcode = '42501';
    end if;
    if new.completed_at is not null and old.completed_at is null then
      new.completed_at := now();        -- server time, not the phone clock
    end if;
    return new;
  end if;

  raise exception 'You do not have permission to change this task.' using errcode = '42501';
end $$;

do $$
begin
  if to_regclass('public.delegations') is not null then
    execute 'drop trigger if exists smhrms_delegations_guard on public.delegations';
    execute 'create trigger smhrms_delegations_guard before insert or update on public.delegations
             for each row execute function public.smhrms_delegations_guard()';
  end if;
end $$;

-- 5) field visit cancel ---------------------------------------------------------
alter table public.field_visits add column if not exists cancelled_at timestamptz;
alter table public.field_visits add column if not exists cancelled_by uuid;
alter table public.field_visits add column if not exists cancel_reason text;

create or replace function public.field_visit_cancel_v1(p_visit_id uuid, p_reason text)
returns public.field_visits
language plpgsql security definer set search_path = public as $$
declare
  v public.field_visits;
  v_company uuid := public.my_company_id();
  v_manager boolean;
begin
  if auth.uid() is null or v_company is null then
    raise exception 'Your session is no longer valid. Please sign in again.';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Please give a reason for cancelling the visit.';
  end if;
  select * into v from public.field_visits where id = p_visit_id and company_id = v_company for update;
  if v.id is null then
    raise exception 'Visit not found in your organization.';
  end if;
  v_manager := public.is_company_admin()
               or exists (select 1 from public.profiles e where e.id = v.employee_id
                          and auth.uid() in (e.manager_id, e.field_manager_id));
  if v.employee_id <> auth.uid() and not v_manager then
    raise exception 'You do not have permission to cancel this visit.';
  end if;
  if v.status in ('completed', 'cancelled') then
    raise exception 'This visit is already %.', v.status;
  end if;
  if v.employee_id = auth.uid() and not v_manager and v.status in ('checked_in', 'meeting') then
    raise exception 'You are already at this visit. Complete it, or ask your manager to cancel it.';
  end if;
  update public.field_visits
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = left(btrim(p_reason), 500)
   where id = v.id
  returning * into v;
  return v;
end $$;

revoke all on function public.field_visit_cancel_v1(uuid, text) from public, anon;
grant execute on function public.field_visit_cancel_v1(uuid, text) to authenticated;

-- field visit guard: cancel columns are lifecycle fields (only via RPC)
create or replace function public.smhrms_field_visits_cancel_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.smhrms_is_browser_role() then return new; end if;
  if tg_op = 'UPDATE' and (new.cancelled_at is distinct from old.cancelled_at
       or new.cancelled_by is distinct from old.cancelled_by
       or new.cancel_reason is distinct from old.cancel_reason) then
    raise exception 'Use the Cancel visit button.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.cancelled_at := null; new.cancelled_by := null; new.cancel_reason := null;
  end if;
  return new;
end $$;

drop trigger if exists smhrms_field_visits_cancel_guard on public.field_visits;
create trigger smhrms_field_visits_cancel_guard before insert or update on public.field_visits
for each row execute function public.smhrms_field_visits_cancel_guard();

commit;
