# Owner actions required — Phase 1 + 2

Only steps that cannot be done from the repository are listed. Do them **in this order**.

---

## A1. Give Claude push access to GitHub (2 minutes)

- **Where:** https://github.com/apps/claude/installations/select_target
- **What:** Install the Claude GitHub App on the `systemmaster1` account → *Only select repositories* → `SM_HRMS` → Install.
  (Alternative: claude.ai → Settings → Connectors → GitHub → reconnect.)
- **Expected:** Claude can push branch `hardening/phase-1-2-audit-p0` and open a Pull Request.
- **Do NOT:** give access to repositories that are not needed.

## A2. Run the read-only security audit in Supabase (5 minutes)

- **Where:** Supabase Dashboard → project → **SQL Editor** → **New query**
- **What:** paste the whole of `docs/sql/01_schema_security_audit.sql` → **Run** → **Download CSV**.
- **Then:** new query → paste `docs/sql/02_live_tenant_isolation_test.sql` → **Run** → **Download CSV**.
- **Safe?** Script 01 only reads. Script 02 impersonates users, and every probe is rolled back; no data changes (verified in a test database).
- **Expected:** script 02 shows `PASS` on every line. Any `FAIL` = release blocker → send both CSV files to Claude.
- **Do NOT:** share the CSVs publicly (they list table and policy names).

## A3. Commit a baseline of the production schema (10 minutes, needs a computer)

The core tables/RLS/RPCs are not in GitHub, so a rebuild after a disaster is impossible.

- **Where:** a computer with Node.js. Supabase Dashboard → Project Settings → Database → *Connection string* (URI, "Session pooler").
- **What:**
  ```bash
  npx supabase@latest db dump --db-url "<connection string>" --schema public,storage -f supabase/baseline/20261004_production_schema.sql
  ```
  Send the file to Claude (or attach it here). It contains structure only — **no data, no passwords**.
- **Do NOT:** use `--data-only` or include `auth` schema data.
- **Expected:** a single `.sql` file with `create table` / `create policy` / `create function` statements.

## A4. Apply the P0 database guards (after A2 is clean or reviewed)

- **Where:** Supabase → SQL Editor → New query
- **What:** paste `supabase/migrations/20261004_p0_security_guards.sql` → Run. It is additive and can be run again safely.
- **Expected:** "Success. No rows returned".
- **Verify:** run `docs/sql/01_schema_security_audit.sql` again — section *11 P0 guard trigger* shows `Installed` for all five.
- **If something legitimate is blocked** (e.g. an Admin cannot save a setting): the exact rollback lines are at the bottom of the migration file; each guard can be removed on its own. Then tell Claude what was blocked.

## A5. Deploy the web changes

- After A1, Claude opens a Pull Request. **Review → Merge**. Vercel deploys automatically.
- **Verify on the live site:**
  1. Open `https://hrms.systemmaster.in/delete-account` in a private/incognito window → page opens **without** login.
  2. Sign in as an Admin (not Owner) → Team → edit the Owner → saving shows *"Only the Organization Owner can edit the Owner's details."*
  3. Field visits: Start Meeting before Check In → friendly error, no status change.

## A6. Build and test the Android app (before merging Android changes to main)

- **Where:** GitHub → repository → **Actions** → *Build Android APK + Play Store AAB* → **Run workflow** → Branch: `hardening/phase-1-2-audit-p0`.
- **Expected:** green build. Branch builds are **not** published to users any more; download the APK from the run's *Artifacts*.
- **Test on a real phone (fresh install):**
  1. Attendance IN with location → a disclosure dialog appears → *Continue* → Android location prompt → location recorded.
  2. After sign-in, Android 13+ asks for notification permission once.
  3. Field employee with tracking ON: IN → "Duty Tracking" notification; screen off 15 min; OUT → notification disappears.
- **Note:** version is now `1.8.5 (14)`.

## A7. Decide: do we need ACCESS_BACKGROUND_LOCATION? (decision only)

Duty tracking runs as a **foreground service started while the app is open**, which Android allows with normal ("while in use") location. Keeping `ACCESS_BACKGROUND_LOCATION` triggers Google Play's strict background-location review (video, declaration, possible rejection).
- **Option 1 (recommended for the first release):** remove it; tracking continues while the duty notification is shown. Restart after reboot/force-stop needs the employee to open the app.
- **Option 2:** keep it; Claude adds the separate background-permission flow and the Play declaration video script.
Tell Claude which option.

## A8. Fix Android App Links fingerprint

- **Where:** the Android workflow log, step *Show signing certificate (for assetlinks.json)* → copy the `SHA256` line.
  If Play App Signing is enabled, also copy Play Console → Setup → App integrity → *App signing key certificate* → SHA-256.
- **What:** send the fingerprint(s) to Claude (they are public values), who updates `public/.well-known/assetlinks.json`.
- **Verify:** https://developers.google.com/digital-asset-links/tools/generator → "Test statement" passes.

---

**Nothing else is required for Phases 1–2.** Supabase/Vercel environment variables do not change in this branch.
