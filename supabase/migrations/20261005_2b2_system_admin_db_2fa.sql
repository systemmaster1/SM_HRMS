-- =============================================================================
-- SM HRMS · Phase 2b-2 · System Admin 2-step verification enforced IN THE DATABASE
-- 2026-10-05 · SAFE TO RE-RUN · NO DATA IS CHANGED
--
-- Before: the OTP (2FA) was checked only by the /system-admin page. A stolen
-- platform-admin password could call the system_admin_* database functions
-- directly through the API, without any OTP.
--
-- After: every public.system_admin_* function additionally requires that the
-- caller has an unexpired, unrevoked row in system_admin_2fa_sessions (created
-- only after a correct emailed OTP; 30-minute lifetime). Server code using the
-- service role is unaffected.
--
-- How: each system_admin_* function body is re-created with its admin check
-- `is_platform_admin()` / `is_system_admin()` replaced by
-- `smhrms_sysadmin_verified()`. Signatures, grants and logic stay the same.
-- is_platform_admin() itself is NOT changed (the login page and the 2FA
-- screens still use it to decide who may start verification).
--
-- Rollback: the original definitions are in
--   supabase/baseline/20261004_production_schema_snapshot.sql
-- =============================================================================
begin;

create or replace function public.smhrms_sysadmin_verified()
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := nullif(coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_setting('request.jwt.claim.role', true)), '');

  -- Trusted backend (Vercel server with the service role key).
  if v_role = 'service_role' then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  if not (coalesce(public.is_platform_admin(), false) or coalesce(public.is_system_admin(), false)) then
    return false;
  end if;

  return exists (
    select 1 from public.system_admin_2fa_sessions s
    where s.user_id = auth.uid()
      and s.revoked_at is null
      and s.expires_at > now()
  );
end $$;

revoke all on function public.smhrms_sysadmin_verified() from public, anon;
grant execute on function public.smhrms_sysadmin_verified() to authenticated, service_role;

-- Rewrite the admin check inside every system_admin_* function.
do $$
declare
  f record;
  def text;
  newdef text;
begin
  for f in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'system\_admin\_%'
      and p.prokind = 'f'
  loop
    def := pg_get_functiondef(f.oid);
    newdef := regexp_replace(def, '(public\.)?is_(platform|system)_admin\(\)',
                             'public.smhrms_sysadmin_verified()', 'g');
    if newdef <> def then
      execute newdef;
      raise notice 'System Admin 2FA now enforced in %', f.proname;
    end if;
  end loop;
end $$;

commit;

-- VERIFY (read-only): every row should say true
--   select p.proname, pg_get_functiondef(p.oid) like '%smhrms_sysadmin_verified%' as enforced
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname like 'system\_admin\_%'
--     and p.proname <> 'system_admin_permanently_delete_organization';
