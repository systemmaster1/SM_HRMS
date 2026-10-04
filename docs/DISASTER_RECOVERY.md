# Disaster recovery

_Last reviewed: 6 Oct 2026. Status: **NOT VERIFIED** — no restore has been tested yet._

## What exists today

| Asset | Where | Backup today | Gap |
|---|---|---|---|
| Database (all organizations) | Supabase project `SM HRMS` (ap-south-1), Postgres 17, ~22 MB | **None automatic** (Free plan has no daily backups or point-in-time recovery) | **P0**: move to Pro (daily backups, 7 days) |
| Schema (structure) | `supabase/baseline/20261004_production_schema_snapshot.sql` + `supabase/migrations/` | Git | Data not included (by design) |
| Files (logos, avatars, documents, selfies, task files) | Supabase Storage, ~30 MB / 143 files | **None** | Storage is not covered by Supabase DB backups on any plan → periodic export |
| Organization copy | Client-owned Google Sheet backup (only orgs that enabled it) | Daily 00:00 IST + manual | Covers HR tables, not files; client-owned |
| Web app | Vercel (from GitHub `main`) | Git history | Redeploy any commit |
| Android | GitHub Releases + workflow artifacts; signing key in GitHub Secrets | Git | Keep an **offline copy of the keystore + passwords**; losing it blocks all app updates |
| Secrets | Vercel env vars, Supabase settings | none | Keep in a password manager (names in `.env.example`) |

## Targets (proposed)

| | Target | Needs |
|---|---|---|
| RPO (data loss) | ≤ 24 h | Pro plan daily backup; ≤ 5 min with PITR add-on |
| RTO (time to restore) | ≤ 4 h | This runbook + a tested restore |

## Runbook A — restore the database (Pro plan)

1. **Stop writes**: Supabase → Settings → General → *Pause* is too drastic for a partial issue; instead set Vercel env `MAINTENANCE_MODE=1` (to be added) or temporarily remove the domain from Vercel. Android keeps queuing GPS points offline (Android 1.8.6+), so nothing is lost on the phones.
2. Note the exact time of the incident (UTC).
3. **Never restore straight over production first.** Supabase → Database → Backups → *Restore to a new project* (or download the backup). Create project `smhrms-restore-YYYYMMDD`.
4. In the restored project run read-only checks: row counts of `companies`, `profiles`, `attendance`, `leaves`, `delegations`, `field_visits`, `employee_location_history` and the latest `created_at` of each.
5. Decide: (a) **full swap** — point Vercel `NEXT_PUBLIC_SUPABASE_URL` / keys to the restored project, update Android `WEB_APP_URL` only if the domain changes (it does not), redeploy; or (b) **selective repair** — copy only the damaged rows back with SQL from the restored project.
6. Re-apply any migrations created after the backup time (`supabase/migrations/`, by date).
7. Re-enable pg_cron jobs (`20261005_2b5_cron_schedules.sql`) on the new project; re-set `private.push_config` and Vercel secrets.
8. Run `docs/sql/01_schema_security_audit.sql` and `02_live_tenant_isolation_test.sql` on the result.
9. Lift maintenance mode; post an incident note to affected organizations.

## Runbook B — restore a single organization's data

Use the restored project (A3) and copy rows `where company_id = '<org>'` table by table (parents first: `companies`, `profiles`, then child tables). Auth users are separate: recreate missing logins from the `auth.users` of the restored project via the Supabase Admin API.

## Runbook C — files (Storage)

Until an automated export exists: monthly, run a script with the service role key that lists every bucket and downloads all objects to an encrypted drive (`supabase storage` CLI or a small Node script). Restore = upload with the same paths (`<company_id>/<employee_id>/<file>`).

## Restore test (required before calling backups verified)

Quarterly, and once before Play Store production:
1. Restore the latest backup to a new project.
2. Run checks A4 and A8.
3. Point a **preview** Vercel deployment at it and sign in as a test owner.
4. Record date, backup timestamp, duration, issues → table below. Delete the restore project afterwards.

| Date | Backup time | Duration | Result | By |
|---|---|---|---|---|
| — | — | — | not yet tested | — |
