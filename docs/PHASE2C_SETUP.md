# SM HRMS: Phase 2C Setup Guide
## Field tracking, route review, PDF visit log, smoother visit screen

Estimated time: 10 minutes. **No database changes** in this phase.
It works best with Phase 2B installed: 2B provides the original planned times, reschedule history and reminders.

---

## What this update adds

### New screen: Field tracking (menu: Work → Field tracking)

**Live now** (managers and admins)
- A map of every field employee:
  - 🟢 live
  - 🟠 weak signal
  - ⚪ offline or off duty
- A side list with each person's status, last update and **distance travelled today**.
- Team totals: live, weak signal, offline and total team distance.
- The map refreshes every minute. Tap a person to open their day.

**Day review** (any person, any date)
- The **route drawn on the map**, with start and last position.
- **Numbered visit pins**:
  - green: completed
  - blue: in progress
  - red: missed
- **Stops** of 10 minutes or more, and **GPS gaps** (dashed red: phone off, no signal or tracking stopped).
- Summary:
  - distance
  - visits done / planned
  - on-time arrival %
  - time in field
  - stops
  - GPS gaps
- A **timeline** of the whole day in order: first GPS, travel started, reached (late or early vs. plan), meeting, completed, stops, gaps, last GPS.
- **Planned vs. actual** card for every visit, including the originally planned time if it was rescheduled, and time spent at the client.

Employees see the same screen as **"My day"**, for their own route and visits only.

### Professional PDF visit log (per person)
Open **Field tracking → Visit log PDF**, choose the employee and date range (quick picks: Today, Last 7 days, This month, Last month), and download.

The report contains:
- Your company name and logo, the employee's details and the period.
- Summary: visits planned, completed, in progress, missed; on-time %; distance; time at clients.
- Every visit: planned time (and the first plan, if rescheduled), reached, finished, time at the client, early or late, status, outcome, person met, notes and follow-up.
- Daily movement: first and last GPS, time in field, km, stops and GPS gaps, with totals.
- A footer on every page stating that times are system-recorded and cannot be edited.

A sample is attached (`Sample_Visit_Log.pdf`).

> Distance is measured from GPS points. Inaccurate fixes and impossible jumps are filtered out, and small movements under 25 m (standing still) are ignored. Treat it as a close estimate, not an odometer reading.

### Field visits screen
- Clear tabs with counts:
  - **Today**
  - **Upcoming**
  - **Pending**: past visits not completed, shown with a red count
  - **Completed**
  - **All**
- Today and Upcoming are sorted by planned time.
- A new **"Live tracking"** button for managers, and **"My day & route"** for employees.
- **Change planned time** in *Visit details*, for managers or for the employee before travel starts.
  - The original plan is kept.
  - The employee is notified when a manager makes the change.
  - A fresh 30-minute reminder is scheduled for the new time.

### Downloads now work inside the Android app (v1.5.0)
PDF reports and all CSV exports (attendance, tasks, register and others) now open the Android share sheet. From there the user can open the file, save it to Files or Drive, or send it on WhatsApp or email. Before this, downloads did nothing inside the app.

---

## STEP 1: Upload to GitHub

Extract the zip. From inside `SM_HRMS-main`, upload:

- **Root files:** `package.json` and `package-lock.json`. **This is required**, because new map and PDF libraries were added. Without them the Vercel build will fail.
- **Folders:** `src`, `android-app`, `docs`

Commit. Then:
1. **Vercel** deploys the website (2–3 min).
2. **GitHub Actions** builds Android **v1.5.0** (5–8 min). Installed apps update over the top, with no uninstall needed.

---

## STEP 2: Test checklist

- [ ] **Work → Field tracking** shows the map with your field staff and today's km.
- [ ] Tap a person, and their route appears under **Day review**. Use ◀ ▶ to move between days.
- [ ] A day with visits shows numbered pins and a timeline.
- [ ] **Visit log PDF → This month → Download PDF** works on a computer.
- [ ] In the **Android app**, the same PDF opens the share sheet.
- [ ] In the Android app, **Attendance → Attendance register → Export** also opens the share sheet.
- [ ] **Field visits** shows the Today / Upcoming / Pending / Completed tabs.
- [ ] Open a planned visit → **Visit details → Change planned time** → save. The employee receives "Visit rescheduled".

If **Change planned time** shows *"Could not update: …"* when a manager uses it, your database only lets employees edit their own visits. Send me the message and I'll add the manager permission.

---

## Changed files

```
package.json, package-lock.json            (leaflet, jspdf, jspdf-autotable)
src/app/(app)/tracking/page.tsx            (new: Field tracking)
src/components/TrackingMap.tsx             (new: OpenStreetMap map)
src/lib/tracking.ts                        (new: distance, stops, GPS gaps)
src/lib/visit-pdf.ts                       (new: PDF visit log)
src/lib/download.ts                        (new: downloads in browser and app)
src/lib/export.ts                          (CSV exports use the new download)
src/app/(app)/field-visits/page.tsx        (tabs, tracking link, reschedule)
src/components/Shell.tsx                   (menu: Field tracking)
android-app/app/build.gradle.kts           (v1.5.0)
android-app/app/src/main/AndroidManifest.xml
android-app/app/src/main/res/xml/file_paths.xml                        (new)
android-app/app/src/main/java/in/systemmaster/hrms/NativeBridge.kt     (saveFile)
docs/PHASE2C_SETUP.md                      (new)
```
