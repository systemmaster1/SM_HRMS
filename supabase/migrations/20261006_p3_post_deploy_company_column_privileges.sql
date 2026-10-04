-- =============================================================================
-- SM HRMS · Phase 3 (POST-DEPLOY) · Hide legacy Google Sheet secret columns
-- 2026-10-06 · SAFE TO RE-RUN · NO DATA IS CHANGED
--
-- !!! APPLY ONLY AFTER the web app version that selects COMPANY_COLUMNS
-- !!! (instead of select("*")) on companies is deployed.
--
-- companies.gsheet_webhook_url / gsheet_secret are legacy copies of the
-- backup integration settings (the live ones are in company_integrations,
-- Owner/Admin only). Through the company-wide companies SELECT policy every
-- employee could read them. Browsers lose access to these two columns only.
--
-- New column added to companies later?  select public.smhrms_apply_company_column_grants();
-- Rollback:  grant select, insert, update on public.companies to authenticated;
-- =============================================================================
begin;

create or replace function public.smhrms_apply_company_column_grants()
returns text language plpgsql security definer set search_path = public as $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'companies'
    and column_name not in ('gsheet_webhook_url', 'gsheet_secret');
  execute 'revoke select, insert, update on public.companies from anon, authenticated';
  execute format('grant select (%s) on public.companies to authenticated', cols);
  execute format('grant insert (%s) on public.companies to authenticated', cols);
  execute format('grant update (%s) on public.companies to authenticated', cols);
  return cols;
end $$;

revoke all on function public.smhrms_apply_company_column_grants() from public, anon, authenticated;
select public.smhrms_apply_company_column_grants();

commit;
