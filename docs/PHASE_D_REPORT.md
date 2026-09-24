# SM HRMS: Phase D Report
## SystemMaster Super Admin panel and organization management

> **About Phase C.** Phase C adds module and organization checks *inside your existing database functions* (for example GPS recording, visit actions and check-in). It is **on hold** until I receive the database structure CSV, because I can't safely change functions I can't see. Phase D does not depend on it.

---

## 1. What was changed

`/system-admin` has been rebuilt into a full control panel, with 5 tabs. Only SystemMaster administrators can open it: **access is checked on the server before the page loads**, and again inside every database function the panel calls.

### Overview
- **Organizations:** total, active, suspended.
- **Billing:** free, trial, paid.
- **Ads:** organizations showing ads vs. ad-free.
- **Users:** total employees, and active users in the last 30 days.
- **Growth:** new registrations in the last 7 and 30 days, plus a registrations-per-month chart.
- **Module adoption:** how many organizations use each module and sub-feature.
- A banner when **module requests** are waiting.

### Organizations
- **Columns:** Organization ID, name, admin and contact, registration date, plan, plan end, employees, enabled modules, ads status, account status, last activity.
- **Search** by name, Organization ID, admin name, email or phone.
- **Filters:** status, Free/Trial/Paid, ads, module.
- **Sorting** on columns, **pagination** (25 per page, handled by the server), and **CSV export**.
- **Click a row** to open the organization panel:
  - Full profile, counts and last activity.
  - **Suspend / Activate**, with a reason shown to the organization.
  - **Ads:** Follow plan / Show ads / Ad-free.
  - **Modules:** each module and sub-feature can be set to **Default / On / Off**, with a reason. On/Off is locked for the organization. The panel shows who decided each one (SystemMaster, Organization, Existing client, or plan).
  - **Pending requests** can be approved or declined.
  - **Subscription:** plan, status, licensed users, custom price, discount, extend days, and +30 days. This uses your existing subscription function unchanged.
  - **Recent changes** from the audit log.

### Module requests
Pending / Approved / Declined / Cancelled / All, with **Approve** and **Decline** (with a note).

### Features & availability
Set each module to **Free / Paid / Coming soon / Disabled** for all organizations, without any code change. A confirmation explains the effect first.

### Audit log
Every administrative change across all organizations: who, which organization, action, and old → new value. It is searchable and paginated.

### Access control
- A new `platform_admins` list lets you grant or remove SystemMaster access with one SQL line.
- Your existing `is_system_admin()` check keeps working alongside it.
- The page is hidden from search engines (`noindex`).

---

## 2. Files changed

**New**
```
supabase/migrations/20260928_phaseD_system_admin.sql
src/app/system-admin/layout.tsx          ← server-side access check
src/components/sysadmin/shared.tsx
src/components/sysadmin/OverviewTab.tsx
src/components/sysadmin/OrganizationsTab.tsx
src/components/sysadmin/OrgDrawer.tsx
src/components/sysadmin/RequestsTab.tsx
src/components/sysadmin/FeaturesTab.tsx
src/components/sysadmin/AuditTab.tsx
docs/PHASE_D_REPORT.md
```
**Replaced**
```
src/app/system-admin/page.tsx            ← full panel (the old subscription editor lives inside the organization panel)
```

---

## 3. Database changes (additive only)

| Object | Purpose |
|---|---|
| `platform_admins` | SystemMaster access list. Cannot be read through the API |
| `is_platform_admin()` | Updated: accepts `platform_admins` members **or** your existing `is_system_admin()` |
| `system_admin_overview()` | Dashboard numbers and charts |
| `system_admin_org_list()` | Search, filter, sort and paginate organizations (server side) |
| `system_admin_org_detail()` | One organization: profile, modules, requests, subscription, audit |
| `system_admin_module_requests()` | Requests across all organizations |
| `system_admin_audit()` | Global audit log |
| `org_billing_class()`, `org_subscription_json()`, `org_last_activity()` | Internal helpers (not callable from the app) |

**Free / Trial / Paid** is read from your existing `company_subscriptions`:
- `active` or `past_due` counts as **Paid**
- `trial` counts as **Trial**
- anything else, including no subscription, counts as **Free**

---

## 4. Environment variables
**None.**

---

## 5. Test results

Tested on PostgreSQL 16 with 4 organizations.

| # | Test | Result |
|---|---|---|
| 1 | Organization owner calls the panel functions → refused | ✅ |
| 2 | Anonymous visitor → refused; cannot read `platform_admins` | ✅ |
| 3 | New admin added via `platform_admins` → access granted | ✅ |
| 4 | Overview: counts for orgs, active, free/trial/paid, ads, employees, active users, new registrations, module adoption | ✅ |
| 5 | List: search by name and by Organization ID; filters for billing, module and ads | ✅ |
| 6 | Sort by name + page size 2, page 2 → correct rows | ✅ |
| 7 | SQL-injection attempt through the sort field → safely ignored | ✅ |
| 8 | Organization detail: profile, counts, admin, per-module source (SystemMaster / Organization / plan), audit | ✅ |
| 9 | Requests and audit functions | ✅ |
| 10 | Migration re-runs cleanly | ✅ |
| 11 | TypeScript check and production build | ✅ |

---

## 6. Known limitations
- **Subscription save** uses your existing `system_admin_update_subscription()`, which checks your **old** `is_system_admin()`. An admin added **only** through `platform_admins` can use everything in the panel **except** saving subscriptions. See Step 4 below to check this.
- **Last activity** is each organization's most recent user sign-in.
- **Per-organization usage limits** (e.g. maximum employees per plan) belong to Phase E.

---

## 7. Remaining work
**C** checks inside existing database functions (needs the CSV) · **E** plan management and upgrades · **F** ads entitlements · **G** Play Store readiness · **H** security audit.

---

# ✅ Your action checklist: Phase D

### Step 1: Run the database update (Supabase)
1. Extract **`SM_HRMS-phaseD.zip`**.
2. Open **`SM_HRMS-main/supabase/migrations/20260928_phaseD_system_admin.sql`**, press **Ctrl + A**, then **Ctrl + C**.
3. Go to **Supabase → SQL Editor → + New query**, press **Ctrl + V**, then click **Run**.

**You should see:** "Success", with an empty table at the bottom (no one in `platform_admins` yet).
❌ If you see a red **ERROR**, send a screenshot and stop.

### Step 2: Give yourself SystemMaster access (Supabase)
Run this in a new query. **Replace** `your-systemmaster-email@example.com` with the email you use to log in as SystemMaster. Keep the quotes.

```sql
insert into public.platform_admins (user_id, note)
select id, 'SystemMaster owner' from auth.users
where email = 'your-systemmaster-email@example.com'
on conflict do nothing;

select u.email from public.platform_admins p join auth.users u on u.id = p.user_id;
```
**You should see:** your email in the result.
If the result is empty, the email doesn't match an account exactly. Check the spelling, or sign up with that email first.

### Step 3: Upload the code (GitHub)
1. On GitHub, open **Add file → Upload files**.
2. From inside **`SM_HRMS-main`**, drag the **`src`**, **`supabase`** and **`docs`** folders.
3. Click **Commit changes**.
4. Wait for **Vercel → Deployments → Ready**.

### Step 4: Test it
1. Log in with the SystemMaster email and open **`https://<your-website>/system-admin`**.
2. **Overview:** numbers and charts appear.
3. **Organizations:** your organizations are listed. Try search, a filter and sorting.
4. Click an organization, then **Modules → Payroll → Off** and enter a reason. Log in as that organization's admin (another browser): Payroll has disappeared. Set it back to **Default**.
5. In the same panel, **Subscription → +30 days**:
   - ✅ "Subscription updated": everything works.
   - ❌ An error: your account passes the new access list but not your old `is_system_admin()`. Run this and **send me the result**, and I'll align the two:
     ```sql
     select pg_get_functiondef('public.is_system_admin'::regproc);
     ```
6. Log in as a **normal employee** and open `/system-admin`. It must show **"not authorized"**.

### Step 5: Send me
- [ ] A screenshot of the Overview tab.
- [ ] The result of Step 4.5 (success, or the function definition).
- [ ] The **database structure CSV**, which unlocks Phase C.

### To remove someone's SystemMaster access later
Replace the email, keeping the quotes:
```sql
delete from public.platform_admins
where user_id = (select id from auth.users where email = 'person-to-remove@example.com');
```
