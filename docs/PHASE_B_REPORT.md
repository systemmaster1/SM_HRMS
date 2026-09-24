# SM HRMS: Phase B Report
## New client registration and module selection

---

## 1. What was changed

### New registration wizard (`/onboarding`)
New clients sign up (name, email, password), confirm their email, and then go through **4 steps**:

| Step | Fields |
|---|---|
| **1. Organization** | Organization name, industry, number of employees, time zone. *Organization ID and registration date are created automatically.* |
| **2. Admin & contact** | Admin name, mobile (validated), organization email, address, city, state, PIN code (validated) |
| **3. Modules** | Attendance, Leave Management, **Task Management → Delegation only / Checklist only / Both**, **Field Employee Management → Tracking only / Visits only / Both**, Payroll. Each is marked **Free** or **Paid · on request** |
| **4. Review** | Optional company logo (PNG/JPG/SVG, up to 2 MB) and a summary of everything entered |

After **Create organization**, the client sees their **Organization ID** (e.g. `ORG-00125`) with a copy button, plus a note if any paid modules were requested.

The module list comes from the **feature catalogue** in the database. If SystemMaster makes a module free, or adds a new one, it appears here without code changes.

### How module choices are applied

| Choice | Result |
|---|---|
| Free module selected | Switched on immediately |
| Free module **not** selected | Switched off, and it disappears from menus, routes and data (e.g. Delegation only means Checklist is not available) |
| Paid module selected | An **activation request** is sent to SystemMaster. The module stays off until approved. **No self-upgrade** |
| Module already included in the organization's plan | Switched on (no request needed) |
| Module set by SystemMaster | The organization cannot change it (shown as "Set by SystemMaster") |
| Existing clients (grandfathered) | May switch their modules off and on again freely, with no request needed |

### Settings → Plan & Features
- **Change modules** opens the same picker used at registration.
- Each paid module that isn't active shows **Request activation**. This replaces the email link from Phase A.
- Status badges: **Active**, **Requested**, **Coming soon**, **Disabled by SystemMaster**.
- Switching a module off **hides** it; its data is kept and returns when it's switched back on.

### SystemMaster
Pending requests can be approved or declined with SQL now; the panel UI comes in Phase D. Approval turns the module on and closes the request. Every step is written to the audit log.

---

## 2. Files changed

**New**
```
supabase/migrations/20260927_phaseB_onboarding.sql
src/components/ModulePicker.tsx          ← shared module selector (registration + Settings)
docs/PHASE_B_REPORT.md
```
**Changed**
```
src/app/onboarding/page.tsx              ← new 4-step registration wizard
src/components/PlanFeaturesCard.tsx      ← Change modules + Request activation
src/lib/features/registry.ts, server.ts  ← entitlements include locked modules and open requests
```

---

## 3. Database changes (additive only)

| Object | Change |
|---|---|
| `organization_feature_overrides.source` | New column: `platform` (SystemMaster), `organization` (client), `grandfathered` (existing client) |
| `organization_module_requests` | New table: requests for paid modules (pending / approved / declined / cancelled) |
| `companies.address`, `state`, `pincode`, `email`, `onboarding_completed_at` | New columns (only added if missing). Existing organizations are marked as registration complete |
| `org_set_modules()` | Client admin chooses modules (applies the rules above) |
| `org_request_module()` | Client admin requests one paid module |
| `complete_organization_setup()` | Saves registration details, admin profile and modules; returns the Organization ID |
| `system_admin_decide_module_request()` | SystemMaster approves or declines a request |
| `system_admin_set_feature()`, `my_entitlements()` | Updated: SystemMaster decisions are marked `platform`; entitlements include locked modules and open requests |

**Nothing is dropped or deleted.** Your existing `create_company` function is **reused unchanged**. The wizard calls it first, then saves the extra details.

---

## 4. Environment variables
**None.**

---

## 5. Test results

Tested on PostgreSQL 16, on top of the Phase A test database.

| # | Test | Result |
|---|---|---|
| 1 | New organization registers: details saved, email normalised, admin profile updated, `ORG-00004` returned | ✅ |
| 2 | Picks Attendance + Delegation only + Field Visits + Payroll → Attendance and Delegation ON; Leave and Checklist OFF; Field, Visits and Payroll **requested**, not enabled | ✅ |
| 3 | Later switches to Delegation + Checklist (Both) and drops Payroll → Checklist ON, Payroll request cancelled | ✅ |
| 4 | Employee (not admin) tries to choose or request modules → refused | ✅ |
| 5 | Another organization cannot see these requests | ✅ |
| 6 | SystemMaster approves Field + Visits → enabled; requests marked approved with the note | ✅ |
| 7 | Client tries to switch off modules set by SystemMaster → refused ("locked"), unchanged | ✅ |
| 8 | Existing client switches Payroll off, then on again → no request needed | ✅ |
| 9 | Invalid time zone rejected | ✅ |
| 10 | Audit log shows each step, with who did it | ✅ |
| 11 | Migration re-runs cleanly | ✅ |
| 12 | TypeScript check and production build | ✅ |

---

## 6. Known limitations
- **Time zone** is saved with the organization, but attendance, reminders and reports still run on Indian Standard Time. Per-organization time zones will be applied in a later phase. The registration screen says this clearly.
- **Payment:** paid modules are activated by SystemMaster on request. Online payment comes in Phase E.
- **Approving requests:** until the Phase D panel exists, requests are approved with SQL (see below).

---

## 7. Remaining work
**C** module checks inside existing database functions and the Android service (needs the database structure CSV) · **D** SystemMaster panel · **E** plans and upgrades · **F** ads · **G** Play Store readiness · **H** security audit.

---

# ✅ Your action checklist: Phase B

**Nothing to replace. No Vercel changes.** Phase A must already be installed (it is).

### Step 1: Run the database update (Supabase)
1. Extract **`SM_HRMS-phaseB.zip`**.
2. Open **`SM_HRMS-main/supabase/migrations/20260927_phaseB_onboarding.sql`** in Notepad or VS Code.
3. Press **Ctrl + A**, then **Ctrl + C**.
4. Go to **Supabase → SQL Editor → + (New query)**, press **Ctrl + V**, then click **Run**.

**You should see:** "Success", with an empty table at the bottom (no requests yet).
❌ If you see a red **ERROR**, send a screenshot and stop.

### Step 2: Upload the code (GitHub)
1. On GitHub, open your repo → **Add file → Upload files**.
2. From inside **`SM_HRMS-main`**, drag the **`src`**, **`supabase`** and **`docs`** folders.
3. Click **Commit changes**.

### Step 3: Wait for the deployment (Vercel)
Open **Vercel → Deployments** and wait for **Ready** (green), about 2–3 minutes.

### Step 4: Test it
**A. As your current admin**
1. Go to **Admin → Settings → Plan & Features**.
2. Click **Change modules**. You should see all modules as **Active**.
3. Close the window without saving (unless you want to change something).

**B. As a brand-new client** (use an email you haven't used before)
1. Open the website in a private/incognito window and click **Sign up**.
2. Confirm the email, then complete the 4 steps. In Step 3, choose **Task Management → Delegation only** and tick **Payroll**.
3. You should see **"Your organization is ready"**, an **Organization ID**, and *"Activation requested: Payroll"*.
4. On the dashboard: **Tasks** shows only **Delegation**, and there is **no Payroll** or **Checklist**.

**C. Approve the request as SystemMaster** (Supabase → SQL Editor)
```sql
-- 1. See pending requests
select r.id, c.org_code, c.name, r.feature_key, r.requested_at
from organization_module_requests r join companies c on c.id = r.company_id
where r.status = 'pending';

-- 2. Approve one (paste the id from step 1 between the quotes)
select system_admin_decide_module_request('PASTE-REQUEST-ID-HERE', true, 'Approved');

-- or decline it
select system_admin_decide_module_request('PASTE-REQUEST-ID-HERE', false, 'Not available yet');
```
The **only** thing to replace here is `PASTE-REQUEST-ID-HERE`, with the `id` value from the first query.
After approving, the test client refreshes the page and **Payroll** appears.

### Step 5: Send me
- [ ] A screenshot of the success screen showing the Organization ID (Step 4B).
- [ ] Any error you saw.
- [ ] Still pending from earlier: the **database structure CSV**, which is needed for Phase C.
