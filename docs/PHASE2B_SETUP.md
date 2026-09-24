# SM HRMS: Phase 2B Setup Guide
## Work calendar, attendance register, automatic tasks and reminders

Estimated time: 15–20 minutes. Complete the steps in this order.

---

## What this update adds

### Work calendar
- Each company sets its **weekly off days** (default: Sunday), plus optional **Saturdays off** (for example, 2nd and 4th).
- Individual employees can be given a **different weekly off**, for example retail staff who are off on Tuesday.
- **Public holidays** from the Holidays page are applied automatically. Optional and restricted holidays are not treated as days off.

### Daily attendance register
Every active employee gets one entry for every day. Each entry has one of these statuses:

| Code | Status | When |
|------|--------|------|
| P | Present | Checked in |
| L | Late | Checked in after the grace time |
| HD | Half day | Marked half day |
| LV | On leave | Approved leave |
| H | Holiday | Public holiday |
| WO | Weekly off | Company or employee weekly off |
| A | Absent | Working day, no check-in, day closed at 11:55 PM |

- The day's register refreshes every 30 minutes. Holidays, weekly offs and approved leave appear from 12:00 AM.
- If someone works on a holiday or weekly off, the entry shows **Present**, with a note ("Worked on holiday").
- The previous day is re-checked at 12:40 AM, to pick up late leave approvals.
- To view it, go to **Attendance → Attendance register** (or the **Monthly register** button on the Attendance page). It shows a month grid with totals, search, department filter and export.
- The new **Attendance Register** tab is included in the Google Sheet nightly sync.
- Existing attendance, payroll and auto-attendance logic is **not changed**. The register is built from it.

### Recurring tasks: fully automatic
- The server creates checklist tasks **every night at 12:15 AM for the next 7 days**, at each checklist's frequency. It no longer depends on someone opening the Tasks page.
- No task is created on a holiday or weekly off.
  - **Daily** tasks skip those days.
  - Weekly, monthly and other frequencies move to the **next working day**.
- Due times are kept within the company's **working hours** (Settings → Work start / Work end).
- Monthly tasks created for the 31st fall on the last day of shorter months (30th, or 28th/29th in February).
- Tasks missed for more than 3 days are skipped, instead of flooding employees with overdue items.
- A new checklist creates its tasks immediately.
- Delegations stay one-time, as before.

### Reminders (sent as phone notifications through Phase 2)

| Reminder | Sent to | When |
|----------|---------|------|
| **Your plan for today** | Employee | At the company's work start time on working days (not on leave) |
| **Task due soon** | Employee | 30 minutes before a task's due time |
| **Visit in 30 minutes** | Employee | 30 minutes before a planned visit |
| **New visit planned** | Employee | When a manager plans a visit for them |
| **Visit rescheduled** | Employee | When a manager changes the planned time |
| **Overdue** | Person who assigned the delegation | Once, when it becomes overdue |

### Field visits: tamper-proof history
- Once a step is recorded (accepted, travel started, reached, checked in, meeting started, completed), **its time can never be changed or cleared by anyone**.
- The **original planned time is kept permanently**. Every reschedule is stored in history, with who changed it and when.
- The Google Sheet **Field Visits** tab now shows these columns:
  - *Planned for*
  - *Originally planned*
  - *Times rescheduled*
  - *Plan status*: Completed, In progress, Planned, or Missed / pending
  - *Arrival delay (min)*
  - The actual time of every step

---

## STEP 1: Enable scheduled jobs in Supabase (1 min)

In the Supabase Dashboard, open **Integrations → Cron → Enable**.
(If you already enabled it for Phase 1 auto-attendance, skip this step.)

## STEP 2: Run the database update (2 min)

1. Open **Supabase → SQL Editor → New query**.
2. Paste the full contents of `supabase/migrations/20260925_phase2b_automation.sql` and click **Run**.
3. At the bottom of the results you should see two numbers:
   - `register_rows_today`: roughly the number of active employees
   - `recurring_tasks_created`: the tasks created for the next 7 days

If you see an error instead, **send me a screenshot of it** and do not continue. The update is safe to run again once fixed.

To confirm the scheduled jobs exist, run:
```sql
select jobname, schedule from cron.job where jobname like 'smhrms-%' order by 1;
```
You should see 5 jobs: `smhrms-attendance-close`, `smhrms-attendance-today`, `smhrms-attendance-yesterday`, `smhrms-recurring-tasks` and `smhrms-reminders`.

## STEP 3: Upload the code to GitHub

Extract the zip and upload these folders from inside `SM_HRMS-main`: **`src`**, **`supabase`** and **`docs`**. Then commit.
Vercel deploys automatically in 2–3 minutes.

## STEP 4: Set up the calendar (admin)

1. **Settings → Weekly off:** select the weekly off days. Optionally select Saturdays off, then click **Save changes**.
2. **Holidays:** make sure this year's public holidays are added.
3. **Team → Edit employee → Attendance Setup → Weekly off:** set a custom weekly off only for employees who differ from the company.
4. **Attendance → Attendance register:** for earlier months of this year, open each month and click **Rebuild month**. New days fill in automatically from now on.

> After adding a holiday or approving a leave for a past date, click **Rebuild month** for that month.

---

## STEP 5: Test checklist

- [ ] **Attendance register** shows today, with LV for anyone on approved leave and "–" for people not yet checked in.
- [ ] The next day, yesterday's missing check-ins show **A** (absent).
- [ ] Create a **daily** checklist in Tasks. Tasks appear for the next working days, and none on Sunday or holidays.
- [ ] Create a checklist with a due time outside working hours (for example 7:00 AM). It is moved to the work start time.
- [ ] As a manager, plan a field visit for an employee 40 minutes from now. The employee gets **"New visit planned"** immediately and **"Visit in 30 minutes"** about 10 minutes later.
- [ ] Reschedule that visit. The employee gets **"Visit rescheduled"**.
- [ ] The next morning at work start time, employees receive **"Your plan for today"**.
- [ ] The next morning, the Google Sheet has an **Attendance Register** tab and the new Field Visits columns.

### Monitoring (optional)
```sql
-- Last runs of the scheduled jobs
select j.jobname, d.status, d.return_message, d.start_time
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
order by d.start_time desc limit 15;

-- Reminders sent today
select kind, count(*) from public.notifications
where created_at > now() - interval '1 day' group by 1;
```

---

## Changed files

```
supabase/migrations/20260925_phase2b_automation.sql      (new)
src/app/(app)/attendance/register/page.tsx               (new)
src/app/(app)/attendance/page.tsx                        (Monthly register button)
src/app/(app)/tasks/page.tsx                             (uses the new task engine)
src/app/(app)/team/[id]/edit/page.tsx                    (employee weekly off)
src/app/api/team/update/route.ts                         (saves employee weekly off)
src/app/(app)/help/page.tsx
src/components/SettingsForm.tsx                          (company weekly off)
src/components/Shell.tsx                                 (menu: Attendance register)
src/lib/gsheet-backup.ts                                 (register tab, planned vs actual)
docs/PHASE2B_SETUP.md                                    (new)
```
