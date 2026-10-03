-- =============================================================================
-- SM HRMS · Production schema & RLS security audit  (READ-ONLY)
--
-- Why: the core tables (profiles, companies, attendance, leaves, delegations,
-- field_visits, payroll ...) and their RLS policies were created directly in
-- Supabase and are NOT in the repository, so they cannot be verified from code.
--
-- How: Supabase Dashboard → SQL Editor → New query → paste this whole file →
--      Run → click "Download CSV" (or copy the result grid) and attach it to the
--      audit conversation. Nothing is changed by this script.
--
-- Output: one result grid with columns (severity, section, object, detail).
--   severity: P0 = cross-tenant / privilege risk, P1 = must fix, INFO = context
-- =============================================================================
with
tenant_tables as (
  select c.oid, n.nspname as schema, c.relname as tbl, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
pol as (
  select schemaname, tablename, policyname, cmd, roles::text as roles, coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
  from pg_policies where schemaname in ('public', 'storage')
),
has_company as (
  select table_name from information_schema.columns
  where table_schema = 'public' and column_name = 'company_id'
),
findings as (
  -- 1) Tables reachable through the API without RLS
  select 'P0' as severity, '1 RLS disabled' as section, t.tbl as object,
         'Row Level Security is OFF. Any signed-in user of ANY organization can read/write it through the API if grants exist.' as detail
  from tenant_tables t
  where not t.rls
    and (has_table_privilege('authenticated', t.oid, 'select') or has_table_privilege('anon', t.oid, 'select'))

  union all
  -- 2) Tenant tables whose policies never mention company_id / my_company_id
  select 'P1', '2 Tenant filter not visible in policy', p.tablename || ' · ' || p.policyname || ' (' || p.cmd || ')',
         'Policy on a table with company_id does not reference company_id/my_company_id(). Check it cannot return other organizations'' rows. USING: ' || left(p.qual, 300)
  from pol p
  where p.schemaname = 'public'
    and p.tablename in (select table_name from has_company)
    and p.qual !~* '(company_id|my_company_id|is_platform_admin|is_system_admin|auth\.uid\(\))'
    and p.with_check !~* '(company_id|my_company_id)'

  union all
  -- 3) Policies that are always true
  select 'P0', '3 Always-true policy', p.schemaname || '.' || p.tablename || ' · ' || p.policyname || ' (' || p.cmd || ' to ' || p.roles || ')',
         'USING/WITH CHECK is "true": every row is allowed for these roles.'
  from pol p
  where (btrim(p.qual) in ('true', '(true)') or btrim(p.with_check) in ('true', '(true)'))
    and p.roles !~ 'service_role'

  union all
  -- 4) Write privileges for the anonymous (not signed in) role
  select 'P0', '4 anon can write', t.tbl,
         'anon has ' || concat_ws(', ',
            case when has_table_privilege('anon', t.oid, 'insert') then 'INSERT' end,
            case when has_table_privilege('anon', t.oid, 'update') then 'UPDATE' end,
            case when has_table_privilege('anon', t.oid, 'delete') then 'DELETE' end) ||
         case when t.rls then ' and a write policy applies to anon/public' else ' AND RLS IS OFF' end
  from tenant_tables t
  where (has_table_privilege('anon', t.oid, 'insert') or has_table_privilege('anon', t.oid, 'update') or has_table_privilege('anon', t.oid, 'delete'))
    -- Supabase grants these by default; it matters only when RLS is off or a
    -- policy applies to anon/public.
    and (not t.rls or exists (select 1 from pol p where p.schemaname = 'public' and p.tablename = t.tbl
                              and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
                              and (p.roles ~ 'anon' or p.roles ~ 'public')))

  union all
  -- 5) SECURITY DEFINER functions without a fixed search_path
  select 'P1', '5 SECURITY DEFINER without search_path', p.oid::regprocedure::text,
         'Set "set search_path = public" to prevent search_path hijacking.'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')

  union all
  -- 6) SECURITY DEFINER functions the anonymous role can execute
  select 'P1', '6 anon can execute SECURITY DEFINER', p.oid::regprocedure::text,
         'Callable without signing in. Confirm it checks auth.uid()/role internally, or revoke from anon.'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('anon', p.oid, 'execute')

  union all
  -- 7) SECURITY DEFINER functions taking a company/organization id parameter
  select 'P1', '7 Definer function takes a company id', p.oid::regprocedure::text,
         'Takes a company/org id from the caller. Verify it rejects ids of other organizations (cross-tenant UUID attack).'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'execute')
    and exists (select 1 from unnest(coalesce(p.proargnames, '{}')) a where a ~* '(company|org)')
    and p.proname !~ '^system_admin_'

  union all
  -- 8) Public storage buckets
  select case when b.public then 'P1' else 'INFO' end, '8 Storage bucket', b.id,
         case when b.public then 'PUBLIC bucket: anyone with the URL can download files.' else 'Private bucket.' end
  from storage.buckets b

  union all
  -- 9) Storage policies (to review folder = company_id isolation)
  select 'INFO', '9 Storage policy', p.tablename || ' · ' || p.policyname || ' (' || p.cmd || ')', left(p.qual || ' | ' || p.with_check, 400)
  from pol p where p.schemaname = 'storage'

  union all
  -- 10) profiles policies (privilege escalation surface)
  select 'INFO', '10 profiles policy', p.policyname || ' (' || p.cmd || ' to ' || p.roles || ')', left('USING: ' || p.qual || ' | CHECK: ' || p.with_check, 500)
  from pol p where p.schemaname = 'public' and p.tablename = 'profiles'

  union all
  -- 11) Guards from 20261004_p0_security_guards.sql installed?
  select case when exists (select 1 from pg_trigger where tgname = g.name) then 'INFO' else 'P0' end,
         '11 P0 guard trigger', g.name,
         case when exists (select 1 from pg_trigger where tgname = g.name) then 'Installed' else 'MISSING — run supabase/migrations/20261004_p0_security_guards.sql' end
  from (values ('smhrms_profiles_guard'), ('smhrms_field_visits_guard'), ('smhrms_leaves_guard'),
               ('smhrms_support_meetings_guard'), ('trg_smhrms_lock_location_history')) g(name)

  union all
  -- 12) Capacity snapshot (largest tables)
  select 'INFO', '12 Table size', t.tbl,
         pg_size_pretty(pg_total_relation_size(t.oid)) || ' · ~' || greatest(c.reltuples, 0)::bigint || ' rows'
  from tenant_tables t join pg_class c on c.oid = t.oid
  where pg_total_relation_size(t.oid) > 1024 * 1024

  union all
  select 'INFO', '12 Database size', current_database(), pg_size_pretty(pg_database_size(current_database()))
)
select severity, section, object, detail
from findings
order by case severity when 'P0' then 0 when 'P1' then 1 else 2 end, section, object;
