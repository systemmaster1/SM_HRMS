# SM HRMS: Phase 2D (part 2) Setup Guide
## Mobile and interface polish

Estimated time: 5 minutes. **No database or Vercel changes.**

## What changed

### Proper in-app dialogs (no more browser pop-ups)
The plain browser boxes ("hrms.systemmaster.in says…") are replaced with app-styled dialogs and small notifications (toasts):
- **Re-opening a completed task** now opens a proper dialog, where the reason is required and can span several lines.
- **"Not due yet"** is now a clean information dialog instead of a browser alert.
- **Errors** (task completion, payroll approval, file download) now appear as a toast. On phones it sits above the bottom bar.

### Safety confirmations added
These actions previously deleted data **instantly, with no confirmation**. They now ask first:

| Action | Where |
|--------|-------|
| Delete a checklist | Tasks |
| Delete a holiday | Holidays |
| Delete a policy document | Policies |
| Delete an employee document | Team → employee |
| Delete a branch / department / designation | Organization |
| Delete a custom visit-form field | Field visits → Visit form setup |
| **Import in "Replace everything" mode** | Tasks → Import: now warns that **all** existing checklists or delegations will be deleted |

### Dark mode, everywhere
About 20 screens had no dark-mode styling: Payroll, Help desk, Holidays, Profile, Policies, Team add/edit, Subscription, Visit form setup, most of Attendance, and others. A new styling layer now gives every screen proper dark colours automatically. Screens that already had their own dark design are unchanged. Company logos always keep their white background.

### Attendance on phones
Attendance records now show as **one card per day** on phones, with the date, in → out time, hours, late/auto tags, location and status. Tap a card for full details. Tablets and computers keep the table.

### Loading screens
Pages now show a clean placeholder layout while loading, instead of a bare "Loading…" line.

### Pricing text
The trial banner now shows the company's actual price per user (from its subscription settings). The README's outdated ₹99 is corrected to match the ₹19 launch offer used everywhere else in the app.

## Upload
Extract the zip. From inside `SM_HRMS-main`, upload the **`src`** and **`docs`** folders and **`README.md`**, then commit. Vercel deploys in 2–3 minutes.

## Quick check
- [ ] Switch to dark mode (moon icon) and open Payroll, Holidays, Help desk and Team → Edit. There should be no white panels or unreadable text.
- [ ] Tasks → re-open a completed task (admin): an in-app dialog asks for the reason.
- [ ] Holidays → delete: a confirmation appears.
- [ ] On a phone: Attendance shows day cards.

If any screen still looks wrong in dark mode, send a screenshot and I'll fix that screen directly.
