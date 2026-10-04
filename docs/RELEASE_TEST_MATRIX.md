# Release test matrix

Run before every Internal Testing / Production release. Record **PASS / FAIL / N/A**, tester, device and date in the copy you keep for that release.

Automated (must be green in CI): `npx tsc --noEmit` · `npm run build` · `npm run test:db` (security guards, Phase 2b, Phase 3) · Android workflow build.

## Accounts and data

| Code | Role | Organization | Notes |
|---|---|---|---|
| SA | System Admin | — | in `platform_admins`, OTP mailbox access |
| OA | Owner | ORG-A | |
| AA | Admin | ORG-A | |
| MA | Manager | ORG-A | manager of EA and FA |
| EA | Employee (office) | ORG-A | `must_change_password` on first login |
| FA | Field employee | ORG-A | Field Tracking ON, interval 1–2 min for the test |
| OB / EB | Owner / Employee | ORG-B | used only for cross-tenant checks |

Devices: at least two real Android phones (one Android 13+, one Android 10–12), Chrome desktop, mobile Chrome.

## Critical workflows

| # | Area | Steps | Expected | Roles | Device |
|---|---|---|---|---|---|
| 1 | Signup | New email → OTP → create org → modules | Org created, owner lands on dashboard | new | web |
| 2 | Login / logout | Email + password; logout | Dashboard; logout returns to /login; Android tracking stops | all | web + Android |
| 3 | Forgot password | Request OTP, wrong code ×5, correct code | Lockout after 5; reset works; no forced change after | EA | web |
| 4 | Temporary password | Admin creates EA, EA signs in | Forced to /change-password, then dashboard | AA, EA | Android |
| 5 | Org Admin 2FA | Enable, sign out, sign in | OTP screen before dashboard | OA | web |
| 6 | System Admin 2FA | Sign in as SA, call panel | OTP required; panel data loads only after OTP; after 30 min RPCs refuse until re-verified | SA | web |
| 7 | Add employee | Admin adds employee / manager | Created; Admin cannot add Admin (Owner only) | AA, OA | web |
| 8 | Owner protection | Admin edits Owner email / role | Refused with clear message | AA | web |
| 9 | Ownership transfer | Owner → choose admin → password → new owner accepts | Roles swap atomically, both notified, audit row | OA, AA | web |
| 10 | Attendance IN/OUT | Punch IN, OUT | Server time shown; second IN keeps first punch | EA | Android |
| 11 | Night shift | IN 22:00, OUT 06:00 next day | OUT accepted, duty closed, tracking stops | FA | Android |
| 12 | Disabled employee | Disable EA, EA tries IN | "Your account is not active" | AA, EA | Android |
| 13 | Leave | Apply full day ×3, half day, overlap | Days 3 / 0.5; overlap refused; self-approve refused; manager approves | EA, MA | web |
| 14 | Tasks | Manager assigns; employee completes; employee tries due-date change | Complete OK (server time); due-date change refused; manager re-opens | MA, EA | web |
| 15 | Checklist | Recurring checklist due today | Appears; reminder at due-30 min (cron) | EA | Android |
| 16 | Field visit | Create (no customer → refused), Accept, Start Travel, Check In, Start Meeting, Complete | Each step only in order; Start Meeting before Check In refused | FA | Android |
| 17 | Visit cancel | Cancel planned visit with reason; employee cancel after check-in | Cancelled with reason; employee refused after check-in, manager allowed | FA, MA | web |
| 18 | GPS screen off | FA IN, lock phone 15 min, admin views route | Points every interval; "Duty Tracking" notification visible | FA, AA | Android |
| 19 | Offline GPS | Airplane mode 10 min while on duty, then online | Notification shows points waiting; all points appear afterwards, no duplicates | FA | Android |
| 20 | Reboot | Restart phone on duty | Tracking resumes without opening app (background permission granted) | FA | Android |
| 21 | Background permission | Fresh install as FA | Disclosure 1 → "While using"; disclosure 2 → "Allow all the time" | FA | Android 10+ |
| 22 | Tracking off | Admin turns Field Tracking off for FA | Native service stops at next upload; no new points | AA, FA | Android |
| 23 | Private details | EA edits own bank; colleague opens EA; manager opens EA | Saved; colleague/manager cannot see bank; admin can | EA, MA, AA | web |
| 24 | Payroll | Salary master, run month, payslip | Figures match attendance/LOP rules | AA | web |
| 25 | Reports / export | Attendance, leave, tasks, visits, KM export (CSV/PDF) | Files open; mobile share sheet on Android | AA | web + Android |
| 26 | Notifications | Assign task; approve leave | In-app + push on Android and web | MA, EA | both |
| 27 | AI Assistant | Ask attendance report; confirm "assign task" | Plain-text answer; action executes once even on double tap | MA | web |
| 28 | Help Desk + meeting | Raise ticket; request meeting Sunday / 21:00 / overlapping | Ticket created; invalid slots refused; SA confirms, email sent | AA, SA | web |
| 29 | Meeting reminders | Confirmed meeting in 60 min | One email at T-60, one at T-10 (never duplicated) | AA | email |
| 30 | Google Sheet backup | Integrations → sync now | Sheet updated; failure visible in sync log | AA | web |
| 31 | Suspension | SA suspends ORG-A | ORG-A users see suspended screen; punches refused | SA, EA | both |
| 32 | Account deletion | Open /delete-account signed out | Page opens without login; request path works | anyone | web |

## Cross-tenant checks (must all be refused)

| # | As | Attempt |
|---|---|---|
| X1 | EA (ORG-A) | Read / update / delete any ORG-B row (run `docs/sql/02_live_tenant_isolation_test.sql`) |
| X2 | EA | Set own `role`/`company_id`/`access_permissions` from browser console |
| X3 | AA | Send a notification to EB |
| X4 | AA | Overwrite ORG-B logo in Storage |
| X5 | EA | `select bank_account_number from profiles` (after post-deploy step B) |
| X6 | OA | Call `system_admin_*` RPC |

## Regression tests for historical bugs

| Bug | Automated test |
|---|---|
| Start Meeting "violates status check" | `tests/db/security-guards.test.mjs` (RPC: Start Meeting after check-in) |
| Start Meeting client fallback bypass | same file (direct UPDATE planned → meeting refused) |
| Org delete blocked by GPS lock | same file (server deletes organization) |
| Duplicate punch | `tests/db/phase3.test.mjs` |
| Night-shift OUT | `tests/db/phase3.test.mjs` |
| AI action double execution | atomic claim in `api/ai/actions` (manual double-tap test #27) |
| Reminder duplicates | claim-before-send in support meeting cron (manual #29) |
