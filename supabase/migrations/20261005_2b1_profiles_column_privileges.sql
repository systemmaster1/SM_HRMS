-- =============================================================================
-- SM HRMS · Phase 2b-1 (step B) · Hide private columns of profiles from browsers
-- 2026-10-05 · SAFE TO RE-RUN · NO DATA IS CHANGED
--
-- !!! APPLY ONLY AFTER the web app version that reads private details through
-- !!! get_employee_private_details() is deployed (PR "phase-2b" merged + Vercel
-- !!! deploy finished). Older web versions select("*") from profiles and would
-- !!! fail after this step.
--
-- Browser roles (anon/authenticated) lose direct SELECT/INSERT/UPDATE on:
--   date_of_birth, address, city, state, pincode, bank_account_name,
--   bank_account_number, bank_ifsc, bank_name, emergency_contact_name,
--   emergency_contact_phone
-- All other columns keep exactly today's access (RLS unchanged).
-- Server code (service role) and SECURITY DEFINER functions are unaffected.
--
-- When a NEW column is added to profiles later, run:
--   select public.smhrms_apply_profile_column_grants();
-- otherwise browsers cannot read the new column.
--
-- Rollback:  grant select, insert, update on public.profiles to authenticated;
-- =============================================================================
begin;

create or replace function public.smhrms_apply_profile_column_grants()
returns text language plpgsql security definer set search_path = public as $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles'
    and column_name <> all (public.smhrms_private_detail_keys());

  execute 'revoke select, insert, update on public.profiles from anon, authenticated';
  execute format('grant select (%s) on public.profiles to authenticated', cols);
  execute format('grant insert (%s) on public.profiles to authenticated', cols);
  execute format('grant update (%s) on public.profiles to authenticated', cols);
  return cols;
end $$;

revoke all on function public.smhrms_apply_profile_column_grants() from public, anon, authenticated;

select public.smhrms_apply_profile_column_grants();

commit;
