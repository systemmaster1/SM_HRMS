-- =============================================================================
-- SM HRMS · Phase D · SystemMaster Super Admin panel (backend)
--
-- Run ONCE in Supabase → SQL Editor AFTER Phase A and B. Safe to re-run.
-- Additive only. Every function below refuses anyone who is not a
-- SystemMaster administrator.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) SystemMaster administrators
--    Your existing is_system_admin() keeps working. This table is an extra,
--    explicit list so access can be granted/revoked without code changes.
-- -----------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
-- No policies: not readable through the API at all.

create or replace function public.is_platform_admin() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text := nullif(coalesce(
                   nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role',
                   current_setting('request.jwt.claim.role', true)), '');
  ok boolean := false;
begin
  if v_role is null or v_role = 'service_role' then
    return true;                                    -- SQL Editor / pg_cron / server key
  end if;
  if v_role <> 'authenticated' then
    return false;
  end if;
  if exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    return true;
  end if;
  begin
    execute 'select public.is_system_admin()' into ok;
  exception when others then
    ok := false;
  end;
  return coalesce(ok, false);
end $$;

-- -----------------------------------------------------------------------------
-- 2) Helpers
-- -----------------------------------------------------------------------------
/** Subscription row as JSON (tolerates column differences). */
create or replace function public.org_subscription_json(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if to_regclass('public.company_subscriptions') is null then return null; end if;
  execute 'select to_jsonb(s) from public.company_subscriptions s where s.company_id = $1 limit 1'
    into v using p_company;
  return v;
exception when others then
  return null;
end $$;

/** free | trial | paid — from the subscription status. No subscription = free. */
create or replace function public.org_billing_class(p_company uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare s jsonb := public.org_subscription_json(p_company); st text;
begin
  st := lower(coalesce(s->>'status', ''));
  if st in ('active', 'past_due') and lower(coalesce(s->>'plan_code', '')) <> 'free' then return 'paid'; end if;
  if st = 'trial' then return 'trial'; end if;
  return 'free';
end $$;

create or replace function public.org_last_activity(p_company uuid) returns timestamptz
language plpgsql stable security definer set search_path = public, auth as $$
declare v timestamptz;
begin
  execute 'select max(u.last_sign_in_at) from auth.users u join public.profiles p on p.id = u.id where p.company_id = $1'
    into v using p_company;
  return v;
exception when others then
  return null;
end $$;

-- -----------------------------------------------------------------------------
-- 3) Dashboard analytics
-- -----------------------------------------------------------------------------
create or replace function public.system_admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  r jsonb;
  v_active_users int := null;
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;

  begin
    execute $q$select count(*) from auth.users u join public.profiles p on p.id = u.id
               where p.company_id is not null and u.last_sign_in_at > now() - interval '30 days'$q$
      into v_active_users;
  exception when others then v_active_users := null;
  end;

  with orgs as (
    select c.id, c.created_at, c.account_status,
           public.org_billing_class(c.id) as billing,
           public.org_ads_enabled(c.id) as ads
    from public.companies c
  )
  select jsonb_build_object(
    'organizations',       (select count(*) from orgs),
    'active',              (select count(*) from orgs where account_status = 'active'),
    'suspended',           (select count(*) from orgs where account_status = 'suspended'),
    'free',                (select count(*) from orgs where billing = 'free'),
    'trial',               (select count(*) from orgs where billing = 'trial'),
    'paid',                (select count(*) from orgs where billing = 'paid'),
    'ads_on',              (select count(*) from orgs where ads),
    'ad_free',             (select count(*) from orgs where not ads),
    'employees',           (select count(*) from public.profiles where company_id is not null
                              and coalesce(status, 'active') not in ('left', 'disabled')),
    'active_users_30d',    v_active_users,
    'new_7d',              (select count(*) from orgs where created_at > now() - interval '7 days'),
    'new_30d',             (select count(*) from orgs where created_at > now() - interval '30 days'),
    'pending_requests',    (select count(*) from public.organization_module_requests where status = 'pending'),
    'registrations_by_month', (
       select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon YY'), 'count', n) order by m), '[]'::jsonb)
       from (
         select gs as m,
                (select count(*) from orgs o
                 where date_trunc('month', o.created_at at time zone 'Asia/Kolkata') = gs) as n
         from generate_series(date_trunc('month', now() at time zone 'Asia/Kolkata') - interval '5 months',
                              date_trunc('month', now() at time zone 'Asia/Kolkata'), interval '1 month') gs
       ) t),
    'module_adoption', (
       select coalesce(jsonb_agg(jsonb_build_object(
                'key', f.key, 'name', f.name, 'parent', f.parent_key, 'availability', f.availability,
                'organizations', (select count(*) from orgs o where public.org_feature_enabled(o.id, f.key)))
              order by f.sort_order), '[]'::jsonb)
       from public.features f)
  ) into r;
  return r;
end $$;

-- -----------------------------------------------------------------------------
-- 4) Organizations table — search, filter, sort, paginate (server side)
-- -----------------------------------------------------------------------------
create or replace function public.system_admin_org_list(
  p_search  text default null,
  p_status  text default null,     -- active | suspended
  p_billing text default null,     -- free | trial | paid
  p_ads     text default null,     -- on | off
  p_module  text default null,     -- feature key that must be enabled
  p_sort    text default 'created_at',
  p_dir     text default 'desc',
  p_limit   int  default 25,
  p_offset  int  default 0
) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_total int;
  v_rows  jsonb;
  v_sort  text := case p_sort
                    when 'name' then 'name' when 'org_code' then 'org_code'
                    when 'employees' then 'employees' when 'last_activity' then 'last_activity'
                    when 'plan_end' then 'plan_end' else 'created_at' end;
  v_dir   text := case when lower(p_dir) = 'asc' then 'asc' else 'desc' end;
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;

  execute format($q$
    with base as (
      select c.id, c.org_code, c.name, c.account_status, c.created_at, c.phone, c.email, c.city,
             c.ads_enabled as ads_override,
             public.org_ads_enabled(c.id) as ads,
             public.org_billing_class(c.id) as billing,
             public.org_subscription_json(c.id) as sub,
             (select count(*) from public.profiles p where p.company_id = c.id
                and coalesce(p.status, 'active') not in ('left', 'disabled')) as employees,
             public.org_last_activity(c.id) as last_activity,
             (select jsonb_build_object('name', p.full_name, 'email', p.email, 'phone', p.phone)
                from public.profiles p where p.company_id = c.id and p.role = 'owner'
                order by p.created_at nulls last limit 1) as admin,
             (select count(*) from public.organization_module_requests r
                where r.company_id = c.id and r.status = 'pending') as pending_requests
      from public.companies c
      where ($1 is null or c.name ilike '%%' || $1 || '%%' or c.org_code ilike '%%' || $1 || '%%'
             or c.phone ilike '%%' || $1 || '%%' or c.email ilike '%%' || $1 || '%%'
             or exists (select 1 from public.profiles p where p.company_id = c.id and p.role = 'owner'
                        and (p.full_name ilike '%%' || $1 || '%%' or p.email ilike '%%' || $1 || '%%')))
        and ($2 is null or c.account_status = $2)
    ), filtered as (
      select b.*,
             coalesce(nullif(b.sub->>'current_period_end', ''), nullif(b.sub->>'trial_ends_at', ''))::timestamptz as plan_end,
             nullif(b.sub->>'current_period_start', '')::timestamptz as plan_start
      from base b
      where ($3 is null or b.billing = $3)
        and ($4 is null or ($4 = 'on' and b.ads) or ($4 = 'off' and not b.ads))
        and ($5 is null or public.org_feature_enabled(b.id, $5))
    )
    select (select count(*) from filtered),
           (select coalesce(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) from (
              select f.id, f.org_code, f.name, f.account_status, f.created_at, f.phone, f.email, f.city,
                     f.admin, f.billing, f.sub->>'plan_code' as plan_code, f.sub->>'status' as sub_status,
                     f.plan_start, f.plan_end, f.employees, f.ads, f.ads_override, f.last_activity,
                     f.pending_requests,
                     (select coalesce(jsonb_agg(ft.key order by ft.sort_order), '[]'::jsonb)
                        from public.features ft where ft.parent_key is null
                          and public.org_feature_enabled(f.id, ft.key)) as modules
              from filtered f
              order by %I %s nulls last, f.id
              limit $6 offset $7) x)
  $q$, v_sort, v_dir)
  into v_total, v_rows
  using nullif(trim(p_search), ''), nullif(p_status, ''), nullif(p_billing, ''), nullif(p_ads, ''),
        nullif(p_module, ''), least(greatest(coalesce(p_limit, 25), 1), 200), greatest(coalesce(p_offset, 0), 0);

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

-- -----------------------------------------------------------------------------
-- 5) One organization — everything SystemMaster needs on one screen
-- -----------------------------------------------------------------------------
create or replace function public.system_admin_org_detail(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare c public.companies; v_plan text;
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;
  select * into c from public.companies where id = p_company;
  if c.id is null then raise exception 'Organization not found'; end if;
  v_plan := public.org_plan_code(p_company);

  return jsonb_build_object(
    'organization', to_jsonb(c) - 'gsheet_secret' - 'gsheet_webhook_url',
    'billing', public.org_billing_class(p_company),
    'subscription', public.org_subscription_json(p_company),
    'ads_effective', public.org_ads_enabled(p_company),
    'last_activity', public.org_last_activity(p_company),
    'admin', (select jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email, 'phone', p.phone)
              from public.profiles p where p.company_id = p_company and p.role = 'owner'
              order by p.created_at nulls last limit 1),
    'counts', jsonb_build_object(
      'employees', (select count(*) from public.profiles where company_id = p_company
                      and coalesce(status, 'active') not in ('left', 'disabled')),
      'admins',    (select count(*) from public.profiles where company_id = p_company and role in ('owner', 'admin')),
      'field_tracked', (select count(*) from public.profiles where company_id = p_company
                          and coalesce((to_jsonb(profiles)->>'field_tracking_enabled')::boolean, false))),
    'features', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'key', f.key, 'parent', f.parent_key, 'name', f.name, 'availability', f.availability,
               'effective', public.org_feature_enabled(p_company, f.key),
               'override', o.enabled, 'source', o.source, 'reason', o.reason, 'updated_at', o.updated_at,
               'by_plan', public.org_feature_enabled_self(p_company, f.key, v_plan) and o.company_id is null)
             order by f.sort_order), '[]'::jsonb)
      from public.features f
      left join public.organization_feature_overrides o on o.company_id = p_company and o.feature_key = f.key),
    'requests', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.requested_at desc), '[]'::jsonb)
      from (select * from public.organization_module_requests where company_id = p_company
            order by requested_at desc limit 20) r),
    'audit', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb)
      from (select created_at, actor_label, action, entity, entity_key, old_value, new_value
            from public.audit_logs where company_id = p_company order by created_at desc limit 30) a)
  );
end $$;

-- -----------------------------------------------------------------------------
-- 6) Module requests across all organizations
-- -----------------------------------------------------------------------------
create or replace function public.system_admin_module_requests(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', r.id, 'company_id', r.company_id, 'org_code', c.org_code, 'org_name', c.name,
             'feature_key', r.feature_key, 'feature_name', f.name, 'status', r.status, 'note', r.note,
             'requested_at', r.requested_at, 'decided_at', r.decided_at, 'decision_note', r.decision_note,
             'requested_by', (select full_name from public.profiles where id = r.requested_by))
           order by r.requested_at desc), '[]'::jsonb)
    from public.organization_module_requests r
    join public.companies c on c.id = r.company_id
    join public.features f on f.key = r.feature_key
    where p_status is null or p_status = '' or r.status = p_status
    limit 500);
end $$;

-- -----------------------------------------------------------------------------
-- 7) Audit log (all organizations, paginated)
-- -----------------------------------------------------------------------------
create or replace function public.system_admin_audit(
  p_search text default null, p_limit int default 50, p_offset int default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_total int; v_rows jsonb; q text := nullif(trim(p_search), '');
begin
  if not public.is_platform_admin() then
    raise exception 'SystemMaster administrators only';
  end if;
  select count(*) into v_total
  from public.audit_logs a left join public.companies c on c.id = a.company_id
  where q is null or c.org_code ilike '%' || q || '%' or c.name ilike '%' || q || '%'
        or a.action ilike '%' || q || '%' or a.entity_key ilike '%' || q || '%' or a.actor_label ilike '%' || q || '%';

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_rows from (
    select a.created_at, a.actor_label, a.action, a.entity, a.entity_key, a.old_value, a.new_value,
           c.org_code, c.name as org_name
    from public.audit_logs a left join public.companies c on c.id = a.company_id
    where q is null or c.org_code ilike '%' || q || '%' or c.name ilike '%' || q || '%'
          or a.action ilike '%' || q || '%' or a.entity_key ilike '%' || q || '%' or a.actor_label ilike '%' || q || '%'
    order by a.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) x;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;

-- -----------------------------------------------------------------------------
-- 8) Permissions
-- -----------------------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.system_admin_overview()',
    'public.system_admin_org_list(text, text, text, text, text, text, text, int, int)',
    'public.system_admin_org_detail(uuid)',
    'public.system_admin_module_requests(text)',
    'public.system_admin_audit(text, int, int)'] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
  foreach fn in array array[
    'public.org_subscription_json(uuid)', 'public.org_billing_class(uuid)', 'public.org_last_activity(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- CHECK: who can open /system-admin (run after adding yourself, see guide)
-- -----------------------------------------------------------------------------
select pa.user_id, u.email, pa.note, pa.created_at
from public.platform_admins pa left join auth.users u on u.id = pa.user_id;
