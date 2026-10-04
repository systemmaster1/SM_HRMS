-- =============================================================================
-- SM HRMS · Phase 2b-4 · Notification authorization + small security fixes
-- 2026-10-05 · ADDITIVE · SAFE TO RE-RUN · NO DATA IS CHANGED OR DELETED
--
-- 1. notifications (browser inserts only):
--    * the recipient must be a member of the SAME organization (before, a
--      member could create a notification row for a user of ANOTHER org);
--    * links must be in-app paths ("/tasks"), never external URLs;
--    * title/body length limits;
--    * per-sender rate limit (300 per 10 minutes) against spam;
--    * created_by records who sent it (server/system rows stay NULL).
--    Server code, triggers and cron are unaffected.
-- 2. is_employee_on_duty_v7 / employee_is_on_duty_v6: answer only for the
--    caller's own organization (was: anyone could ask about any employee).
-- 3. Fixed search_path on 11 helper functions flagged by Supabase advisor.
-- 4. auth_rate_limits + smhrms_rate_limit_hit(): durable rate limiting for the
--    public sign-in / OTP routes (server-only).
-- =============================================================================
begin;

-- 1) notifications ------------------------------------------------------------
alter table public.notifications add column if not exists created_by uuid;
create index if not exists notifications_created_by_time_idx
  on public.notifications (created_by, created_at desc) where created_by is not null;

-- Facts the guard needs, readable regardless of RLS (ids/counts only).
create or replace function public.smhrms_same_org_member(p_user uuid, p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.company_id = p_company);
$$;
create or replace function public.smhrms_notifications_sent_recently(p_actor uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications
  where created_by = p_actor and created_at > now() - interval '10 minutes';
$$;
revoke all on function public.smhrms_same_org_member(uuid, uuid) from public, anon;
revoke all on function public.smhrms_notifications_sent_recently(uuid) from public, anon;
grant execute on function public.smhrms_same_org_member(uuid, uuid) to authenticated;
grant execute on function public.smhrms_notifications_sent_recently(uuid) to authenticated;

-- SECURITY INVOKER on purpose: inside it current_user tells whether the insert
-- came straight from the browser (authenticated/anon) or from trusted
-- server code / SECURITY DEFINER functions (owner role) — only the former is checked.
create or replace function public.smhrms_notifications_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  a record;
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;

  select * into a from public.smhrms_actor();
  if a.user_id is null or a.status <> 'active' or a.company_id is null then
    raise exception 'Please sign in again.' using errcode = '42501';
  end if;
  if new.company_id is distinct from a.company_id
     or new.user_id is null
     or not public.smhrms_same_org_member(new.user_id, a.company_id) then
    raise exception 'You can notify only people in your organization.' using errcode = '42501';
  end if;
  -- empty link (the column default) means "no link" and is fine
  if nullif(new.link, '') is not null and (new.link !~ '^/' or new.link ~ '^//' or position(E'\\' in new.link) > 0) then
    raise exception 'Notification links must point inside SM HRMS.' using errcode = '22023';
  end if;
  if public.smhrms_notifications_sent_recently(a.user_id) >= 300 then
    raise exception 'Too many notifications sent. Please wait a few minutes.' using errcode = '54000';
  end if;

  new.title := left(coalesce(new.title, ''), 160);
  new.body := left(coalesce(new.body, ''), 1000);
  new.created_by := a.user_id;
  new.is_read := false;
  new.pushed_at := null;
  new.push_result := null;
  return new;
end $$;

drop trigger if exists smhrms_notifications_guard on public.notifications;
create trigger smhrms_notifications_guard before insert on public.notifications
for each row execute function public.smhrms_notifications_guard();

-- Recipients may only mark their own notifications read (not rewrite them).
create or replace function public.smhrms_notifications_update_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.smhrms_is_browser_role() then
    return new;
  end if;
  if new.title is distinct from old.title or new.body is distinct from old.body
     or new.link is distinct from old.link or new.kind is distinct from old.kind
     or new.user_id is distinct from old.user_id or new.company_id is distinct from old.company_id
     or new.pushed_at is distinct from old.pushed_at or new.push_result is distinct from old.push_result
     or new.created_by is distinct from old.created_by then
    raise exception 'Only the read status of a notification can be changed.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists smhrms_notifications_update_guard on public.notifications;
create trigger smhrms_notifications_update_guard before update on public.notifications
for each row execute function public.smhrms_notifications_update_guard();

-- 2) duty status only within the caller's organization -------------------------
create or replace function public.is_employee_on_duty_v7(p_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.attendance a
    where a.employee_id = p_employee_id
      and a.company_id = (select company_id from public.profiles where id = p_employee_id)
      and (auth.uid() is null
           or a.company_id = (select company_id from public.profiles where id = auth.uid()))
      and a.work_date = (now() at time zone 'Asia/Kolkata')::date
      and a.check_in is not null
      and a.check_out is null
  );
$$;

do $$
begin
  if to_regprocedure('public.employee_is_on_duty_v6(uuid)') is not null then
    execute 'revoke execute on function public.employee_is_on_duty_v6(uuid) from public, anon';
  end if;
end $$;
revoke execute on function public.is_employee_on_duty_v7(uuid) from public, anon;
grant execute on function public.is_employee_on_duty_v7(uuid) to authenticated, service_role;

-- 3) fixed search_path ---------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('advance_due_date','distance_m','block_early_completion','geo_distance_km_v7',
                        'try_uuid','today_ist','add_months_anchored','companies_assign_org_code',
                        'billing_set_updated_at','set_task_policy_updated_at','ai_touch_conversation')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.sig);
  end loop;
end $$;

-- 4) durable rate limiting for public auth routes (server-only) ---------------
create table if not exists public.auth_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
alter table public.auth_rate_limits enable row level security;  -- no policies: server only
revoke all on public.auth_rate_limits from anon, authenticated;

create or replace function public.smhrms_rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean  -- true = allowed, false = limited
language plpgsql security definer set search_path = public as $$
declare v_hits int;
begin
  insert into public.auth_rate_limits as r (key, window_start, hits)
  values (left(p_key, 200), now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  -- housekeeping: old keys
  delete from public.auth_rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_max;
end $$;

revoke all on function public.smhrms_rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.smhrms_rate_limit_hit(text, int, int) to service_role;

commit;
