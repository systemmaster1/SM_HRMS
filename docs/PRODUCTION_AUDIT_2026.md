# SM HRMS · Production Audit 2026

| | |
|---|---|
| Audited commit | `394d44e` (main, 1 Oct 2026) |
| Fix branch | `hardening/phase-1-2-audit-p0` |
| Audit date | 4 Oct 2026 |
| Method | Full read of API routes, middleware, Supabase clients, all 26 migrations, Android sources, CI; baseline `tsc` + `next build`; database guards executed in embedded PostgreSQL |

**Statuses:** VERIFIED · WORKING BUT NEEDS HARDENING · NEEDS LIVE TEST · BUG · SECURITY RISK · MISSING · OPTIONAL/FUTURE
**Severity:** P0 release blocker / security / data loss · P1 before public production · P2 important · P3 post-launch

> Nothing is marked VERIFIED without repository evidence. Anything that lives only in the production database is **NEEDS LIVE TEST** until the two SQL scripts in `docs/sql/` have been run.

---

## 0. Most important finding

**The core database is not in the repository.** The repo's 26 migrations are incremental add-ons. The tables they depend on — `profiles`, `companies`, `attendance`, `leaves`, `delegations`, `checklist_*`, `field_visits`, `salary_master`, `payroll_actions`, `tickets`, `notifications`, `holidays`, `branches`, `departments`, storage buckets, … — and **their RLS policies** were created directly in Supabase. 33 RPCs the app calls (`check_in`, `get_payroll`, `record_employee_location_v7`, `is_employee_on_duty_v7`, `leave_balance`, `create_company`, `email_for_phone`, …) are also not in the repo.

Consequences:
- Tenant isolation of the most sensitive tables (profiles with bank details, attendance, leave, payroll) **cannot be verified from code**. Status: **NEEDS LIVE TEST (P0)**.
- A disaster-recovery rebuild from the repository is impossible.

What was done: `docs/sql/01_schema_security_audit.sql` (read-only) and `docs/sql/02_live_tenant_isolation_test.sql` (impersonates real users, every probe rolled back) let the owner verify production in minutes. A baseline schema dump must then be committed (see OWNER_ACTION_REQUIRED.md, action A3).

---

## 1. Repository architecture map

```
Browser / Android WebView ──► Next.js 14 (Vercel, App Router)
   │   src/app/(app)/*        authenticated pages (client components, call Supabase directly with the user's JWT → RLS)
   │   src/app/api/*          server routes: auth/OTP, team admin (service role), AI, billing, cron, push hook, system-admin
   │   src/middleware.ts      session refresh + redirect to /login for non-public paths
   │
   ├──► Supabase (Postgres + RLS + Storage + Auth)
   │       supabase/migrations/   incremental only (see §0)
   │       pg_cron                reminders, attendance register, recurring tasks
   │       pg_net trigger         notifications → /api/hooks/push → FCM / Web Push
   │
   ├──► Android app (android-app/): WebView shell + JS bridge "SMHRMSNative"
   │       LocationTrackingService (foreground, type=location) → Supabase REST RPC directly
   │       Firebase Messaging
   │
   └──► External: Gmail API (OTP/email), Razorpay, AI providers (org-supplied keys), Google Apps Script (Sheet backup)
```

Roles: `owner`, `admin`, `manager`, `employee` (+ per-module `access_permissions`: none/self/team/company). Platform admins via `platform_admins` / `system_admins` tables and `is_platform_admin()`.

## 2. Feature inventory (repository evidence)

| Module | Evidence | Status |
|---|---|---|
| Signup / login / email OTP / forgot password | `api/auth/*`, `signup`, `login`, `forgot-password` | WORKING BUT NEEDS HARDENING (in-memory rate limit, see S-12) |
| Org Admin 2FA, System Admin 2FA | `api/security/*`, `api/system-admin/2fa/*`, layouts | WORKING BUT NEEDS HARDENING (UI-level only, S-07) |
| Team management | `api/team/*`, `team/*` | **Hardened in this branch** (S-01…S-04) |
| Attendance IN/OUT, selfie, register, auto attendance | `attendance/*`, RPC `check_in/check_out` (not in repo), `refresh_attendance_log` | NEEDS LIVE TEST (server timestamp lives in missing RPC) |
| Leave, balances, buddy | `leave/*`, RPC `leave_balance` (not in repo) | **Hardened** (overlap, self-approval, decided_by) — NEEDS PRODUCTION MIGRATION |
| Tasks: delegation, checklists, recurring, import, scorecard | `tasks/*`, `em-report`, phase2b migration | NEEDS LIVE TEST |
| Field visits + lifecycle RPC | `field-visits/*`, `field_visit_action_v6` (v8/v9 migrations) | **Bug fixed** (F-01) — Start Meeting regression test added |
| GPS tracking, route history, KM | Android service, `tracking/*`, `route-history/*`, v7 RPCs (not in repo) | WORKING BUT NEEDS HARDENING (A-03…A-06) |
| Payroll | `payroll/page.tsx`, `salary_master`, `payroll_actions`, RPC `get_payroll` (not in repo) | Basic payroll only — see §9 |
| Help Desk, support meetings, reminders | `helpdesk`, `support_meetings` migrations, cron | **Hardened** (S-09, S-10) |
| AI Assistant (Gemini/OpenAI/Anthropic/OpenRouter) | `api/ai/*`, `lib/ai/*` | **Hardened** (AI-01…AI-05) |
| Notifications (web push + FCM) | `api/hooks/push`, `lib/push/*`, `PushRegistrar` | WORKING; Android 13 permission fixed (A-02) |
| Subscriptions / Razorpay | `api/billing/*`, `api/razorpay/webhook` | VERIFIED: webhook HMAC + amount match; plan entitlements in DB (`has_feature`) |
| System Admin | `system-admin/*`, phaseD RPCs | WORKING BUT NEEDS HARDENING (S-07) |
| Google Sheet backup | `lib/gsheet-backup.ts` (client-owned Apps Script web app) | WORKING (Apps Script web-app push, no OAuth); requested OAuth design is Phase 9 |
| Privacy, terms, account deletion page | `privacy`, `terms`, `delete-account` | **Bug fixed**: deletion page required login (P-01) |
| Ownership transfer | — | MISSING (Phase 4) |
| System Health Center | — | MISSING (Phase 8) |
| Offline GPS queue | — | MISSING (A-04) |

## 3. Findings

### 3.1 Security — application / API

| ID | Module · Path | Current behaviour | Problem / impact | Sev | Status after branch | Fix | SQL? | Manual? | Verification |
|---|---|---|---|---|---|---|---|---|---|
| S-01 | Team · `api/team/update` | Admin could edit the Owner's record incl. **login email** | Admin moves Owner's login to their own address → Forgot Password → **organization takeover** | P0 | CODE COMPLETE · BUILD VERIFIED | Only Owner edits Owner; email change of Owner blocked for others | Guard also in DB (S-05) | No | Admin edits owner → 403 |
| S-02 | Team · `api/team/update`, `create` | Admin could set any member's role to `owner` / create admins | Multiple owners, admin self-replication, privilege escalation | P0 | CODE COMPLETE | `owner` never assignable; only Owner grants/removes Admin | DB guard | No | `canAssignRole` + DB tests |
| S-03 | Team · all team routes | Only `role` checked, not `status` | Removed/disabled admin with a still-valid token keeps calling admin APIs | P1 | CODE COMPLETE | `getOrgActor()` requires `status='active'` | — | No | Disabled admin → 401 |
| S-04 | Team · `reset-password`, `remove`, `access` | Admin could reset/remove/restrict another Admin | Admin-vs-admin takeover | P1 | CODE COMPLETE | Owner-only for Admin targets; access levels validated | — | No | — |
| S-05 | DB · `profiles` | Only tracking fields protected by a trigger; other columns depend on unknown RLS | Employee may be able to `update profiles set role='owner'` from the browser console | **P0** | CODE COMPLETE · **NEEDS PRODUCTION MIGRATION** | `20261004_p0_security_guards.sql` profiles guard | **Yes** | Run migration | `npm run test:db` (32 profile cases) + live test 02 |
| S-06 | DB · `profiles` SELECT | Pages load colleagues with `select("*")` (bank account, address, emergency contact) | Any employee can read colleagues' bank numbers if profiles SELECT is company-wide | P1 | Leave page narrowed; **NEEDS LIVE TEST** | Move bank/address/emergency to `employee_private_details` with self+admin RLS | Yes (design) | — | Live test 02 "read colleagues' bank" |
| S-07 | System Admin · 2FA | 2FA only gates the `/system-admin` page; `system_admin_*` RPCs check `is_platform_admin()` only | Stolen platform-admin password works via direct API calls without OTP | P1 | Partly: `/api/system-admin/support-meeting` now requires 2FA | Make RPCs require an unexpired row in `system_admin_2fa_sessions` | Yes | — | Call RPC without 2FA → denied |
| S-08 | Auth · `api/auth/google/start|callback` | Public; displays a Gmail refresh token to whoever authorizes | Setup tool exposed to the internet | P2 | CODE COMPLETE | Platform admin only | — | — | Anonymous → 404 |
| S-09 | Support meetings · RLS | Org admins could `update` their meeting: confirm, change time, edit internal notes | Org self-confirms SystemMaster slots | P1 | NEEDS PRODUCTION MIGRATION | Orgs may only cancel | Yes | Run migration | DB tests |
| S-10 | System Admin · `api/system-admin/support-meeting` | No 2FA, any `status` string, raw DB errors | — | P2 | CODE COMPLETE | 2FA, enum + https validation | — | — | — |
| S-11 | AI · `ai_pending_actions` | Rows are user-writable under RLS; payload executed without re-validation; confirm not atomic | Double execution, crafted payloads | P1 | CODE COMPLETE | Atomic claim + zod re-validation | — | — | Double-click confirm → 409 |
| S-12 | Auth · `resolve-login` | In-memory rate limit (per serverless instance) | Weak brute-force protection | P2 | OPEN | Use Supabase/Upstash store or Supabase Auth rate limits | — | Supabase Auth settings | — |
| S-13 | Hard-coded identities | `connect@systemmaster.in` gate in org-delete routes; owner's personal bank details in receipt templates | Hard to rotate; personal data in code | P3 | OPEN | Move to env/config table | — | — | — |
| S-14 | `notifications` INSERT from browser | Leave/task pages insert notifications for other users | Users can spam/phish colleagues with in-app notifications (links limited to `/…`) | P2 | NEEDS LIVE TEST | Create notifications server-side (trigger/RPC) | Yes | — | — |
| S-15 | Errors | ~90 places show `error.message` to users | Raw Postgres/RLS text reaches users | P2 | Partly fixed (`lib/errors.ts` used in team, AI, field visits, leave) | Roll out `friendlyError()` everywhere | — | — | — |

### 3.2 Security — database (from repo migrations)

| ID | Finding | Sev | Status |
|---|---|---|---|
| D-01 | All SECURITY DEFINER functions in the repo set `search_path` | — | VERIFIED |
| D-02 | Company-wide jobs (`run_reminders`, `refresh_attendance_log`, `generate_recurring_tasks`, `write_audit`) revoked from `anon`/`authenticated` | — | VERIFIED |
| D-03 | Several definer helpers keep Supabase's default `anon` EXECUTE (`org_feature_enabled(uuid,text)`, `day_off_reason`, `next_working_day`) — they accept any company id | P2 | NEEDS LIVE TEST (audit 01 §6/§7 lists them) |
| D-04 | GPS history immutability trigger also blocked **server-side** deletes → permanent organization deletion fails for any org with GPS history; retention impossible | **P0 BUG** | Fixed in migration (verified: old version fails, new passes) |
| D-05 | Support meeting overlap is enforced by an exclusion constraint and business-hours trigger | — | VERIFIED (if migration applied) |
| D-06 | Field visit status constraint includes `meeting` (historic "Start Meeting violates status check") | — | VERIFIED + regression test |

### 3.3 Core reliability

| ID | Module | Finding | Sev | Status |
|---|---|---|---|---|
| F-01 | Field visits | When the lifecycle RPC rejected Start Meeting, the page **fell back to a direct table update** with the phone clock — bypassing every status rule | P1 | Fixed (code) + DB guard (direct status/timestamp writes blocked, trusted `created_at`, Customer Name required) |
| F-02 | Field visits / leave | Double tap could submit twice | P2 | Guarded in code |
| L-01 | Leave | No overlap check; client sets `decided_by/decided_at`; status settable on insert | P1 | Fixed in DB guard (NEEDS PRODUCTION MIGRATION) |
| L-02 | Leave | No server-side validation of `days` and half-day math | P2 | OPEN |
| T-01 | Cron `task-reminders` | N+1: one SELECT + INSERT per open task | P2 | OPEN |
| T-02 | Support meeting reminders | Overlapping runs could send the same reminder twice | P2 | Fixed (claim-before-send) |
| U-01 | `must_change_password` | Set on create/reset but never enforced anywhere | P2 | MISSING |

### 3.4 Android

| ID | Finding | Sev | Status |
|---|---|---|---|
| A-01 | URL trust used `startsWith("https://hrms.systemmaster.in")` → look-alike host `…systemmaster.in.evil.com` would receive the JS bridge and could redirect native GPS uploads **with the user's tokens** | **P0** | Fixed: exact origin + every bridge method checks trusted page. NEEDS ANDROID BUILD |
| A-02 | **Location runtime permission is never requested** (launcher declared, never launched). Fresh installs: geolocation always denied → location attendance, visits and tracking fail. Android 13 notification permission also never requested | **P0 functional** | Fixed with prominent disclosure dialog. NEEDS ANDROID BUILD + REAL DEVICE TEST |
| A-03 | Native service refreshes the Supabase refresh token independently of the WebView. Refresh tokens rotate; whichever side refreshes second may trigger reuse detection → **random logouts / tracking stops** | P1 | OPEN — design: WebView pushes fresh tokens to native on `TOKEN_REFRESHED`; native writes back tokens it refreshed; web calls `setSession` on resume |
| A-04 | No offline GPS queue: failed uploads are dropped | P1 | MISSING (Phase 6) — Room/SQLite queue + `captured_at` param + idempotency key |
| A-05 | No BOOT_COMPLETED restart; START_STICKY restart from background may be blocked on Android 12+ | P1 | NEEDS REAL DEVICE TEST |
| A-06 | Tokens in plain SharedPreferences (backup disabled) | P2 | OPEN — EncryptedSharedPreferences |
| A-07 | Foreground notification uses launcher icon as small icon | P3 | OPEN |
| A-08 | Branch workflow runs would publish APK to production downloads | P1 | Fixed (publish only from main) |
| A-09 | `assetlinks.json` still contains `REPLACE_WITH_RELEASE_KEY_SHA256_FINGERPRINT` → app links not verified | P1 | MANUAL (owner action) |
| A-10 | `ACCESS_BACKGROUND_LOCATION` declared but never requested. If the duty foreground service is enough, removing it simplifies Play review considerably | P0 decision | OWNER DECISION |

### 3.5 Mobile UX (summary — Phase 5)

- Android opens `/login`, not the landing page — VERIFIED (`MainActivity`).
- A first-login guide exists (`FirstLoginGuide.tsx`) — not the slide onboarding requested — MISSING.
- Navigation is one list for all roles with modules hidden by entitlement/access; bottom nav = Home/Attendance/Tasks/Visits for everyone. Role-specific "Today" screens — MISSING.
- Many icon-only buttons with `title` only (tasks, leave approve/reject) — P2 accessibility.
- Error messages often raw (S-15).

## 4. Payroll reality check (§17)

Repository evidence: `salary_master` upsert, `payroll_actions` (approve/reject RPCs), `get_payroll` RPC (not in repo), payslip/summary via AI tool. No code for PF, ESI, PT, LWF, TDS, Form 16, 24Q, gratuity, arrears or monthly lock.
**Classification: Basic Payroll only. Statutory compliance: MISSING.** Marketing must not say "complete Indian payroll".

## 5. Competitor-category gaps (§39)

| Category | SM HRMS today | Class |
|---|---|---|
| Statutory payroll (PF/ESI/PT/TDS/Form16) | Missing | NEXT 90 DAYS |
| Expense claims / reimbursements | Missing | NEXT 90 DAYS |
| Onboarding / offboarding workflows | Offboarding = status "left" only | NEXT 90 DAYS |
| Employee documents | Present (`employee_documents`, private bucket) | — |
| PMS / appraisal | Missing | ENTERPRISE/FUTURE |
| Recruitment / ATS | Missing | ENTERPRISE/FUTURE |
| Asset management | Missing | ENTERPRISE/FUTURE |
| Shift rosters | Auto IN/OUT times only | NEXT 90 DAYS |
| Field force + GPS + route/KM | Present — differentiator | Harden (Phase 6) |
| AI assistant | Present | Harden |

None of these should delay Internal Testing.

## 6. Play Store blockers (current)

1. P0 database verification not yet run in production (§0).
2. `20261004_p0_security_guards.sql` not yet applied.
3. Android build with A-01/A-02 not yet built/tested on devices.
4. Background-location decision (A-10) and matching Data Safety / Privacy text.
5. `assetlinks.json` fingerprint placeholder (A-09).
6. Official launcher/Play icons not in repo (only a base64 placeholder in `android-app/branding`).
7. Account-deletion page was login-protected (**fixed**, needs deploy).

Full gate: `docs/PLAY_STORE_RELEASE_GATE.md`.

## 7. Implementation plan

| Phase | Scope | State |
|---|---|---|
| 1 | Audit | DONE (this document) |
| 2 | P0 security: team APIs, DB guards, Android bridge, deletion page, AI, live-test scripts | CODE COMPLETE on branch · NEEDS PRODUCTION MIGRATION · NEEDS ANDROID BUILD |
| 2b | After live test results: fix any RLS FAIL lines, commit baseline schema, S-06 private details table, S-07 RPC 2FA | NEXT |
| 3 | Attendance/leave/task reliability (server-side days, must_change_password, N+1 cron, friendlyError rollout) | — |
| 4 | Ownership transfer (DB RPC + invitation + audit) | — |
| 5 | Role-based mobile "Today", onboarding slides, button audit | — |
| 6 | GPS: token single-owner (A-03), offline queue (A-04), boot restart, retention design | — |
| 7–12 | AI/Help Desk/notifications, System Health, Google backup (OAuth), Play prep, competitor roadmap, BYO Supabase doc | — |

## 8. Tests added

- `tests/db/security-guards.test.mjs` — runs the real migrations in embedded PostgreSQL: 64 checks (privilege escalation, cross-org edits, Owner protection, field-visit lifecycle incl. **Start Meeting regression**, leave overlap/approval, support meetings, GPS immutability, organization delete). `npm run test:db`, also in CI.
- `docs/sql/02_live_tenant_isolation_test.sql` — production tenant-isolation probe (read-only in effect).
