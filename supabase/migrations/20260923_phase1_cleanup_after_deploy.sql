-- =============================================================================
-- SM HRMS · Phase 1 · Cleanup — run ONLY AFTER the Phase 1 code is live on
-- Vercel and "Sync Google Sheet now" works from the Integrations page.
--
-- Removes the old copy of the Google Sheet secret from the companies table
-- (every employee can read that table). The live copy is in company_integrations.
-- =============================================================================
update public.companies
set gsheet_secret = null, gsheet_webhook_url = null
where gsheet_secret is not null or gsheet_webhook_url is not null;
