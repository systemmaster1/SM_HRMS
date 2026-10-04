-- Phase 5 — approvals: task extension requests
--
-- Problem found while building the Approvals screen: the production policy on
-- task_extensions only checks the organization, so any employee could approve
-- (or edit) any extension request in their organization from the browser.
--
-- This additive guard keeps every current screen working:
--  * request  : only the person the task is assigned to; requested_by, status
--               and decision fields are set by the server
--  * decide   : Owner/Admin of the organization, or the person who assigned the
--               task; only while the request is pending; decision time/by from server
--  * edit     : the requester may change date/time/reason while pending
--  * delete   : Owner/Admin only
-- Server-side (service role / cron / SQL editor) writes are unaffected.
-- Rerunnable. Rollback: drop trigger if exists smhrms_task_extensions_guard on public.task_extensions;

begin;

create or replace function public.smhrms_delegation_brief(p_id uuid)
returns table (company_id uuid, assigned_to uuid, assigned_by uuid)
language sql stable security definer set search_path = public as $$
  select d.company_id, d.assigned_to, d.assigned_by from public.delegations d where d.id = p_id;
$$;
revoke all on function public.smhrms_delegation_brief(uuid) from public, anon;
grant execute on function public.smhrms_delegation_brief(uuid) to authenticated;

create or replace function public.smhrms_task_extensions_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  a record;
  d record;
  changed text[];
  is_admin boolean;
  can_decide boolean;
begin
  if not public.smhrms_is_browser_role() then
    return coalesce(new, old);
  end if;
  select * into a from public.smhrms_actor();
  if a.user_id is null or a.status <> 'active' then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  is_admin := coalesce(a.role in ('owner', 'admin') and a.company_id = coalesce(old.company_id, new.company_id), false);

  if tg_op = 'DELETE' then
    if is_admin then return old; end if;
    raise exception 'Only an Owner/Admin can delete an extension request.' using errcode = '42501';
  end if;

  select * into d from public.smhrms_delegation_brief(coalesce(new.delegation_id, old.delegation_id));
  if d.company_id is null or d.company_id is distinct from a.company_id then
    raise exception 'Task not found in your organization.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if d.assigned_to is distinct from a.user_id then
      raise exception 'Only the person doing the task can ask for more time.' using errcode = '42501';
    end if;
    new.company_id := d.company_id;
    new.requested_by := a.user_id;
    new.status := 'pending';
    new.decided_by := null;
    new.decided_at := null;
    return new;
  end if;

  changed := public.smhrms_changed_keys(to_jsonb(old), to_jsonb(new));
  if coalesce(array_length(changed, 1), 0) = 0 then
    return new;
  end if;
  if changed && array['id', 'company_id', 'delegation_id', 'requested_by', 'created_at'] then
    raise exception 'This extension request cannot be moved.' using errcode = '42501';
  end if;

  can_decide := is_admin or d.assigned_by = a.user_id;

  if changed && array['status', 'decided_by', 'decided_at'] then
    if old.status <> 'pending' then
      raise exception 'This request has already been %.', old.status using errcode = '42501';
    end if;
    if new.status in ('approved', 'rejected') and can_decide then
      new.decided_by := a.user_id;
      new.decided_at := now();
    else
      raise exception 'Only the person who assigned the task or an Owner/Admin can decide this request.' using errcode = '42501';
    end if;
  end if;

  if changed && array['requested_date', 'requested_time', 'reason']
     and not (old.requested_by = a.user_id and old.status = 'pending') then
    raise exception 'Only the requester can change a pending request.' using errcode = '42501';
  end if;

  return new;
end $$;

do $$
begin
  if to_regclass('public.task_extensions') is not null then
    execute 'drop trigger if exists smhrms_task_extensions_guard on public.task_extensions';
    execute 'create trigger smhrms_task_extensions_guard before insert or update or delete on public.task_extensions
             for each row execute function public.smhrms_task_extensions_guard()';
  end if;
end $$;

commit;
