# SM HRMS: Pending Work (single prompt)

Copy everything below the line into a new chat, together with the latest project zip and the database structure CSV.

---

You are continuing development of **SM HRMS**, a multi-tenant HRMS + Task Management + Field Employee Management SaaS by SystemMaster. Work from the attached repository (latest zip) and the attached **database structure CSV** (tables, constraints, functions, triggers and security policies exported from Supabase).

## Current system (already built and tested; do not rebuild)
- **Stack:** Next.js 14 (App Router, TypeScript, Tailwind) on Vercel; Supabase (Postgres, Auth, Storage, RLS, pg_cron, pg_net); Android WebView app in `android-app/` (Kotlin, FCM, native duty-time GPS service); GitHub Actions builds the signed APK.
- **Phases done** (reports in `docs/`): 1 (Sheet sync, private files, signing), 2A (push notifications), 2B (work calendar, attendance register, recurring-task engine, reminders), 2C (tracking map, route/km, PDF visit log), 2D (mobile UI, dialogs, dark mode, polish), **A** (organizations, `features` catalogue, plan + override entitlements, restrictive RLS "tenant wall" on module tables, audit log), **B** (registration wizard, module selection, module requests), **D** (SystemMaster panel at `/system-admin`).
- **The single source of truth for modules** is `src/lib/features/registry.ts` plus the `public.features` table. Entitlements come from `public.my_entitlements()`. Route guards use `src/components/FeatureGate.tsx`.
- **SQL migrations** live in `supabase/migrations/`, dated and in run order.

## Non-negotiable rules
1. Inspect the existing code **and the CSV** before changing anything. Do not remove or break working features.
2. Migrations must be **additive and re-runnable**. If anything could affect production data, explain it and ask before doing it.
3. Every query and function must enforce **organization isolation**. Final access = organization feature **AND** role/user permission, enforced in the **database**, not only in the UI.
4. `SECURITY DEFINER` functions must check the caller's organization and the relevant feature themselves, because they bypass RLS.
5. Test every phase on PostgreSQL with at least two organizations, including cross-tenant and permission-escalation attempts. Run `tsc --noEmit` and `next build`.
6. Professional English in the whole UI. Mobile-first. Dark mode supported.
7. After each phase, report: what changed, files, database changes, environment variables, test results, remaining work. **End every phase with a "Your action checklist"**: exactly which file to run where, what to replace (with the exact placeholder text), what to upload, and what the user should see.

## Pending work, in this order

### Phase C: checks inside existing database functions (use the CSV)
- Add organization + feature checks inside every existing `SECURITY DEFINER` function that touches module data, including `field_visit_action_v6`, `record_employee_location_v7`, `record_tracking_state_v7`, `is_employee_on_duty_v7`, `route_history_summary_v8`, `tracking_distance_today_v7`, `run_auto_attendance`, leave-balance functions, `set_checklist_done`, `get_payroll`, and the payroll actions.
- The Android GPS service must stop server-side when the organization's `field.tracking` is off, or the employee's `field_tracking_enabled` is off.
- Move all browser-side `notifications` inserts (tasks, leave, visits) to database triggers or functions, and remove the client insert permission.
- Commit a complete, reproducible base schema to `supabase/` so the database can be rebuilt from GitHub.

### Phase E: plans, limits and upgrades
- SystemMaster plan editor: create and edit plans (`subscription_plans`), set modules per plan (`plan_features`), prices, ads default, and usage limits (e.g. maximum employees, maximum field-tracked staff). Enforce the limits in the database.
- Settings → Plan & Features: compare plans, upgrade and downgrade requests, and a clear current-usage display.
- A payment-ready structure (Razorpay first): orders, payments, invoices, renewals and webhooks, behind a provider interface so other gateways can be added.
- Downgrade and expiry rules: modules switch off, data is kept.

### Phase F: Free / Paid / Ads / Ad-free
- An ads configuration service (web + Android) driven by `my_entitlements().ads_enabled`. Per-organization override already exists: `companies.ads_enabled`, `system_admin_set_ads()`.
- A "Remove ads" upgrade, applied organization-wide.
- Ads must **never** appear on: attendance check-in/out, forms being submitted, permission prompts, critical alerts, or emergency actions.

### Phase G: Play Store readiness
- Terms & Conditions page; updated Privacy Policy; an in-app **account deletion request** flow (a Play requirement).
- A prominent location-disclosure screen before asking for location; Android background-location compliance; notification permission flow.
- Crash and error logging (web + Android); an app version check with optional force update.
- Android: pull-to-refresh; battery-optimisation guide (Xiaomi, Vivo, Oppo, Realme); resume duty tracking after reboot; stop duplicate web + native tracking; separate login tokens for the native service and the website (to avoid refresh-token reuse logouts); release AAB build; Google Mobile Ads SDK behind the Phase F service.

### Phase H: security audit and production readiness
- Fix `/api/auth/resolve-login`, which reveals the email for any mobile number. Make it rate-limited and non-enumerable.
- Make sure employees cannot read colleagues' bank details (column- or table-level protection).
- Extend the restrictive tenant-wall policies to core tables (profiles, holidays, documents, tickets, branches, departments, designations, notifications) without breaking onboarding.
- Cross-tenant and privilege-escalation tests for every table and function; rate limiting on public endpoints; error monitoring; dependency and secret review.

### Feature upgrades
- **Tasks:** kanban/list toggle, search, filters (Today / Overdue / This week), bulk actions, photo/file proof on completion, team on-time scorecard.
- **Attendance:** regularisation requests ("forgot to check in") with manager approval, check-out reminder, fake/mock-GPS detection in the Android app, server-side IP capture.
- **Time zones:** per-organization support (`companies.timezone` is stored but everything currently runs in IST).
- **Help:** update the Help page and the User Guide PDF for all features from Phases 2–D.
- **Remaining UI:** card layouts on phones for Payroll, Team leave balances, Task scorecard and Field reports.

## Items the user still has to do (remind them)
- Fix the push test ("Could not send"): run the two SQL queries from the Phase 2A troubleshooting message and share the result.
- Run the setup steps for Phases 2B, 2C, 2D, B and D (guides in `docs/`).
- Put the Android release key's SHA-256 into `public/.well-known/assetlinks.json`.

Start by reading the repository and the CSV. List any conflicts you find. Then implement **Phase C** first, following the rules above.
