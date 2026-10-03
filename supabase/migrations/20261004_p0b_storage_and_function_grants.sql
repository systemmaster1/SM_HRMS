-- =============================================================================
-- SM HRMS · P0b hardening found by the LIVE production audit (4 Oct 2026)
-- ADDITIVE · SAFE TO RE-RUN · NO DATA IS CHANGED OR DELETED
--
-- 1. Storage "avatars": any signed-in user could upload over / replace ANY
--    other user's profile photo (no folder check). Now a user can write only
--    inside their own folder "<user_id>/..." (the path the app already uses).
-- 2. Storage "company-logos": an Admin of organization A could replace the
--    logo of organization B. Now only inside "<own company_id>/..." (the path
--    the app already uses).
-- 3. 50+ SECURITY DEFINER functions were executable by the anonymous role
--    (not signed in). None is needed before sign-in; anonymous access is
--    removed. Signed-in users keep exactly the access they have today.
-- 4. enforce_location_mandatory() gets a fixed search_path.
-- =============================================================================
begin;

-- 1) avatars: own folder only ----------------------------------------------
drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2) company-logos: own organization folder only ------------------------------
drop policy if exists logos_admin_write on storage.objects;
create policy logos_admin_write on storage.objects for insert to authenticated
with check (bucket_id = 'company-logos' and public.is_company_admin()
            and (storage.foldername(name))[1] = public.my_company_id()::text);

drop policy if exists logos_admin_update on storage.objects;
create policy logos_admin_update on storage.objects for update to authenticated
using (bucket_id = 'company-logos' and public.is_company_admin()
       and (storage.foldername(name))[1] = public.my_company_id()::text)
with check (bucket_id = 'company-logos' and public.is_company_admin()
            and (storage.foldername(name))[1] = public.my_company_id()::text);

drop policy if exists logos_admin_delete on storage.objects;
create policy logos_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'company-logos' and public.is_company_admin()
       and (storage.foldername(name))[1] = public.my_company_id()::text);

-- 3) No anonymous execution of SECURITY DEFINER functions ---------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.prokind = 'f'
      and p.prorettype <> 'trigger'::regtype
  loop
    -- Keep today's access for signed-in users explicit before removing PUBLIC.
    if has_function_privilege('authenticated', f.sig, 'execute') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

-- New functions created later in "public" should not be anonymous either.
alter default privileges in schema public revoke execute on functions from anon;

-- 4) Fixed search_path ---------------------------------------------------------
do $$
begin
  if to_regprocedure('public.enforce_location_mandatory()') is not null then
    execute 'alter function public.enforce_location_mandatory() set search_path = public';
  end if;
end $$;

commit;

-- =============================================================================
-- VERIFY (read-only):
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
--     and has_function_privilege('anon', p.oid, 'execute');      -- expect 0
-- =============================================================================
