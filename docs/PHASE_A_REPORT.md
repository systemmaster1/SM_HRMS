# SM HRMS: Phase A Report
## Multi-tenant organization and feature entitlement architecture

---

## 1. What was changed

**One central model for "who can use what".**

```
Feature catalogue (features)            ← SystemMaster: FREE / PAID / COMING SOON / DISABLED
  → Plan setting (plan_features)        ← reused from your existing subscription tables
  → Organization override               ← SystemMaster decision per organization
  → Parent module must be ON            ← e.g. Task Management → Checklist
  → Organization not suspended
  = Organization entitlement            (computed in the database)
  AND user role / access permission     (existing Team → Access, now filtered by module)
  = Final access
```

**Enforced in four places, all driven by the same data:**

| Layer | What happens when a module is off |
|---|---|
| **Database** (the real wall) | Its tables return no rows and refuse writes, even if someone calls the database directly with a valid login |
| **Routes** | Opening the URL (e.g. `/payroll`) shows *"Payroll is not enabled"* instead of the page |
| **Menu and mobile bottom bar** | The entry disappears |
| **Screens and background jobs** | Dashboard shortcuts, Export options, Team → Access options, Google Sheet tabs, recurring tasks, reminders, attendance register and location tracking all skip it |

**Tenant wall.** Every module table now has an extra database rule: *a row is visible or writable only by users of the same organization.* This rule is **added on top of** your existing rules. It can only narrow access, never widen it. So even if one of your current rules were too loose, data can no longer cross organizations on these tables.

**Other additions:**
- **Organization ID:** every organization gets a readable ID (`ORG-00001`, `ORG-00002`, …). Existing organizations are numbered in registration order, and new ones get the next number automatically.
- **Suspension:** SystemMaster can suspend an organization. Its users see an "Account suspended" screen and all module data is blocked. **Nothing is deleted**, and re-activating restores everything.
- **Protected platform fields:** organization admins can still edit their profile (name, address, logo). They **cannot** change their own Organization ID, suspension, ads setting, plan, trial date or price per user, even through a direct database call. Such changes are silently ignored.
- **Audit log** of every feature change, suspension, ads change and subscription change: who, which organization, old → new value, and when.
- **Ads entitlement is ready** (organization override → plan default → ads on). Nothing displays ads yet; that is Phase F/G.
- **Task sub-features:** Delegation only, Checklist only, or both. The Tasks screen, Import, the task engine and reminders all follow the setting.
- **Field module split:** *Field Tracking* (GPS, route, km) and *Visit Management* (visits, check-in/out, notes, reports) can be enabled separately. A visits-only organization gets visits, the timeline and the PDF log, but no GPS map, and **no location tracking runs**.
- **Settings → Plan & Features:** shows the Organization ID and each module with an Active or Upgrade / Enable badge. The "Upgrade" button currently opens an email to SystemMaster; online payment comes in Phase E.

**Existing clients: nothing changes on day one.**
- Every current organization is **grandfathered**: all modules stay ON and ads stay OFF.
- Organizations that register **after** this update start on the **Free defaults** (Attendance, Leave and Task Management), unless their plan or SystemMaster says otherwise.

---

## 2. Files changed

**New**
```
supabase/migrations/20260926_phaseA_entitlements.sql
src/lib/features/registry.ts          ← single source of truth: modules, routes, permission keys
src/lib/features/server.ts            ← getEntitlements() (once per request)
src/lib/features/client.tsx           ← EntitlementsProvider, useFeature()
src/components/FeatureGate.tsx        ← server-side route guard
src/components/ModuleLocked.tsx       ← "module not enabled" screen
src/components/OrganizationSuspended.tsx
src/components/PlanFeaturesCard.tsx   ← Settings → Plan & Features
src/app/(app)/{attendance,leave,tasks,em-report,field-visits,field-reports,tracking,route-history,payroll}/layout.tsx
docs/PHASE_A_REPORT.md
```

**Changed**
```
src/app/(app)/layout.tsx              ← loads entitlements, blocks suspended organizations
src/components/Shell.tsx              ← menu + bottom bar follow modules
src/components/DashboardClient.tsx    ← shortcuts/widgets follow modules
src/components/ActiveVisitTracker.tsx ← tracking needs org Field Tracking + employee switch
src/app/(app)/tasks/page.tsx          ← Delegation / Checklist tabs follow sub-features
src/app/(app)/tasks/import/page.tsx
src/app/(app)/tracking/page.tsx       ← visits-only mode
src/app/(app)/export/page.tsx
src/app/(app)/team/access/page.tsx, team/new/page.tsx, team/[id]/edit/page.tsx
src/app/(app)/settings/page.tsx
src/lib/gsheet-backup.ts              ← Sheet tabs follow modules
supabase/migrations/20260925_phase2b_automation.sql  ← background jobs follow modules
```

---

## 3. Database changes (all additive)

| Object | Type | Purpose |
|---|---|---|
| `features` | new table | Module catalogue (9 keys) with availability |
| `organization_feature_overrides` | new table | SystemMaster decisions per organization |
| `audit_logs` | new table | Administrative change history |
| `feature_table_map`, `feature_gate_report` | new tables (internal) | Which table belongs to which module, and what was protected |
| `companies.org_code`, `account_status`, `suspended_reason`, `timezone`, `ads_enabled` | new columns | Organization ID, suspension, time zone, ads override |
| `subscription_plans.ads_enabled` | new column | Plan-level ads default (for Phase F) |
| `org_feature_enabled()`, `has_feature()`, `my_entitlements()`, `org_ads_enabled()` | functions | Entitlement resolution |
| `system_admin_set_feature()`, `system_admin_set_org_status()`, `system_admin_set_ads()`, `system_admin_set_feature_availability()` | functions | SystemMaster controls (backend for the Phase D panel) |
| `smhrms_org_feature_gate` | restrictive rule on 11 module tables | Tenant wall + module check |
| Triggers on `companies`, `organization_feature_overrides`, `company_subscriptions` | triggers | Protect platform fields, write audit log |

**Nothing is dropped.** No existing rule, table, column or row is removed.

---

## 4. Environment variables

**None.**

---

## 5. Manual actions required

1. **Supabase → SQL Editor:** run `supabase/migrations/20260926_phaseA_entitlements.sql`.
   - The result table at the end lists every module table as `protected`, or `skipped: table not found` for tables your database doesn't have. **Send me a screenshot of it.**
   - If you have **not** yet installed Phase 2B, that's fine; the two files work in either order.
2. **GitHub:** upload the `src`, `supabase` and `docs` folders, then commit. Vercel deploys automatically.
3. **Check:**
   - Settings shows **Plan & Features** with your Organization ID and every module Active.
   - Everything works exactly as before.

### Managing organizations until the Phase D panel exists
Run these in the Supabase SQL Editor. Replace `ORG-00002` with the organization's ID from Settings.

```sql
-- Find an organization
select id, org_code, name, account_status from companies order by org_code;

-- Turn a module OFF / ON / back to plan default (null)
select system_admin_set_feature((select id from companies where org_code = 'ORG-00002'), 'payroll', false, 'Not in plan');
select system_admin_set_feature((select id from companies where org_code = 'ORG-00002'), 'tasks.checklist', true, 'Upgraded');
select system_admin_set_feature((select id from companies where org_code = 'ORG-00002'), 'payroll', null, 'Follow plan');

-- Suspend / re-activate
select system_admin_set_org_status((select id from companies where org_code = 'ORG-00002'), 'suspended', 'Payment overdue');
select system_admin_set_org_status((select id from companies where org_code = 'ORG-00002'), 'active', null);

-- Make an organization ad-free (null = follow plan)
select system_admin_set_ads((select id from companies where org_code = 'ORG-00002'), false);

-- Change what a module is for everyone: free | paid | coming_soon | disabled
select system_admin_set_feature_availability('field.tracking', 'paid');

-- What an organization can use right now
select key, org_feature_enabled((select id from companies where org_code = 'ORG-00002'), key) from features order by sort_order;

-- Audit log
select created_at, actor_label, action, entity_key, old_value, new_value from audit_logs order by created_at desc limit 20;
```

Feature keys: `attendance`, `leave`, `tasks`, `tasks.delegation`, `tasks.checklist`, `field`, `field.tracking`, `field.visits`, `payroll`.

---

## 6. Test results

The migration was tested on PostgreSQL 16 with a copy of your schema, with **three organizations** and existing rules deliberately set to *"everyone can see everything"* (to prove the new wall works on its own).

| # | Test | Result |
|---|---|---|
| 1 | Existing organizations grandfathered: all 9 modules ON, ads OFF, ORG-00001/00002 assigned | ✅ |
| 2 | Alpha user sees only Alpha's attendance and salary, despite the "see everything" rule | ✅ |
| 3 | Alpha user writes a row into Beta → refused | ✅ |
| 4 | Alpha user moves its own row into Beta → refused | ✅ |
| 5 | Alpha user creates a "global" row with no organization → refused | ✅ |
| 6 | Shared default rows (e.g. global leave types) still readable | ✅ |
| 7 | Organization admin changes own ID, price, ads → silently ignored; name change allowed | ✅ |
| 8 | Organization admin calls the SystemMaster functions → refused | ✅ |
| 9 | Payroll OFF → salary rows 0; Checklist OFF → checklists 0, delegations still visible | ✅ |
| 10 | Task Management (parent) OFF → Delegation hidden too; back ON → visible again | ✅ |
| 11 | Subtasks follow their delegation (hidden when Delegation is OFF, and never visible to another organization) | ✅ |
| 12 | New organization after launch → Free defaults (Attendance, Leave, Tasks ON; Field, Payroll OFF), ads ON | ✅ |
| 13 | Plan-level setting (plan includes Payroll + Visits) applied; Tracking stays OFF | ✅ |
| 14 | Module globally DISABLED → OFF even for organizations with an override | ✅ |
| 15 | COMING SOON → hidden, unless SystemMaster grants beta access | ✅ |
| 16 | Suspended organization → all module data blocked; re-activated → data intact | ✅ |
| 17 | Anonymous visitor → not admin, sees no audit, override or attendance rows | ✅ |
| 18 | Recurring-task job skips the organization with Checklist OFF | ✅ |
| 19 | Audit log records actor, organization, old → new value | ✅ |
| 20 | Re-running the migration keeps SystemMaster's decisions (no re-grandfathering) | ✅ |
| 21 | Phase A before 2B, or 2B before A: both orders work | ✅ |
| 22 | Route → module mapping for all module routes; core routes stay open | ✅ |
| 23 | Final access = organization feature AND user permission (employee blocked from Payroll; HR allowed; owner blocked when the org lacks the module) | ✅ |
| 24 | TypeScript check and production build | ✅ |

During testing I also caught and fixed a flaw in my own first draft. It would have treated anonymous visitors as platform administrators inside the new functions. The fix is covered by test 17.

---

## 7. Known limitations (planned for later phases)

1. **Some existing database functions bypass these rules.** Your existing functions such as `field_visit_action_v6` and `record_employee_location_v7` run with elevated rights, and the new rules don't apply to them. For example, the Android background service could still record GPS for an organization whose Field Tracking was just switched off, until the employee next opens the app (the app then stops tracking). To close this, the **database structure CSV** is needed so I can add module and organization checks inside those functions. **Phase C.**
2. **Platform fields are protected from customers.** If any of your existing functions change `companies.plan`, `trial_ends_on` or `price_per_user` *on behalf of a customer*, those changes are now ignored. Changes made by SystemMaster or by scheduled jobs are unaffected. This needs checking against the CSV.
3. **Core tables** (profiles, holidays, tickets, documents, and similar) keep your existing rules. The same tenant wall will be extended to them in **Phase H**, after reviewing the CSV.
4. **No SystemMaster panel UI yet.** SystemMaster controls work through the SQL functions above. The panel UI comes in **Phase D**.
5. **Settings is admin-only.** Only admins can open it, so for other users the **View Plan & Features** button on the "not enabled" screen returns to the dashboard.
6. **The employee "own field tracking" switch** is still shown on Team edit when the organization lacks Field Tracking. It has no effect, because tracking needs both switches. It will be hidden in **Phase C**.

---

## 8. Remaining work

| Phase | Scope |
|---|---|
| **B** | New registration: organization details, logo, time zone, **module selection** (Delegation / Checklist / Both) |
| **C** | Module and organization checks inside existing database functions and the Android service; remaining screen polish |
| **D** | SystemMaster panel: analytics, Organizations table, module toggles, suspend/activate, audit viewer |
| **E** | Plan management, Settings → Plan & Features upgrades, payment-ready structure |
| **F** | Free / Paid / Ads / Ad-free entitlements |
| **G** | Play Store readiness and ads integration |
| **H** | Security audit and production readiness |
