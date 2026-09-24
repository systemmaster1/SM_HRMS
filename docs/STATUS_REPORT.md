# SM HRMS: Project Status Report
*Updated after the UI polish round (Android app v1.6.0)*

---

## 1. Overall progress

| Measure | Progress |
|---|---|
| **Work built and tested by me** | **≈ 67%** of the full plan (original audit + SaaS phases A–H) |
| **Confirmed live by you** | Phase 1 and Phase A deployments confirmed. The other phases are waiting for you to run their setup steps and test |

The percentage is weighted by the size of each phase:

| Phase | Weight | Status | Counted |
|---|---:|---|---:|
| 1: Sheet auto-sync, security basics, Android signing, file upload | 8 | ✅ Built · live | 8 |
| 2A: Phone push notifications | 7 | ✅ Built · ⚠️ your test showed "Could not send" (fix SQL sent, result pending) | 7 |
| 2B: Weekly off, attendance register, automatic tasks, reminders | 9 | ✅ Built | 9 |
| 2C: Field tracking map, route and km, PDF visit log | 8 | ✅ Built | 8 |
| 2D: Mobile UI, dialogs, dark mode, **professional polish (this round)** | 7 | ✅ Built | 7 |
| A: Multi-tenant organizations + feature entitlements | 9 | ✅ Built · live | 9 |
| B: Registration wizard + module selection | 6 | ✅ Built | 6 |
| D: SystemMaster Super Admin panel | 7 | ✅ Built | 7 |
| C: Module checks inside existing database functions | 6 | ⛔ Blocked: needs the database structure CSV | 0 |
| E: Plan management, upgrades, payments | 8 | ⬜ Not started | 0 |
| F: Free / Paid / Ads / Ad-free | 4 | 🟡 ~40% (ads setting, per-org override and SystemMaster control exist) | 1.6 |
| G: Play Store readiness | 9 | 🟡 ~25% (signing, push, offline screen, file upload, permissions done) | 2.3 |
| H: Security audit and production readiness | 7 | 🟡 ~30% (tenant wall on module tables, private files, audit log done) | 2.1 |
| Feature upgrades (task kanban, attendance regularisation, fake-GPS check…) | 5 | ⬜ Not started | 0 |
| **Total** | **100** | | **≈ 67** |

---

## 2. What I completed in this round (UI polish)

### Phone app look and feel
- **Pop-ups are now bottom sheets on phones.** Every form and detail window (apply leave, new visit, visit details, change modules, and others) slides up from the bottom with a drag handle, like a native app. Computers still show a centred dialog.
- **The top bar shows the current screen's name** (e.g. "Attendance register"), with the organization name underneath, instead of only the company name.
- **The phone's status and navigation bars follow the app's theme:** white in light mode, dark in dark mode. Previously they stayed white in dark mode.
- **A dark splash screen** when the phone is in dark mode, so there's no white flash while the app loads.
- **A friendly offline screen** ("You're offline · Try again") that reconnects automatically, instead of the browser's error page.
- **Large system fonts are handled:** the app follows the phone's text-size setting, within limits that keep screens looking right.
- **Page headers:** titles and buttons stack properly on small screens, and header buttons scroll sideways instead of squashing the title.
- **Status badges use proper words:** "On the way", "Checked in", "Weekly off", "Payment due" instead of database values like `on_the_way`, with clear colours for Late, On leave, Holiday, Missed and Planned.
- **Bigger close buttons and tap targets** in pop-ups on phones.
- **Smoother scrolling** in the Android app (the fixed background that caused stutter is gone).
- **Keyboard focus rings** and a **reduced-motion** mode for accessibility.

### Field staff visit cards
- **Large action buttons** in a two-column grid on phones: Accept, Start travel, Check in, Start meeting, Complete visit.
- **The planned time** is shown clearly on each visit.
- **Tap-to-call** on the client's phone number.
- **One-tap Directions** to the client's address in Google Maps.

### Professional wording
| Before | After |
|---|---|
| EM Report | **Task scorecard** |
| Own Field Tracking | **Location tracking for this employee** |
| Own / Self | **Own records only** |
| Field GPS stays OFF unless explicitly enabled | GPS tracking stays off unless you turn it on |
| Daily KM / historical route replay | Daily distance (km) and route history |
| "…server-trusted in v6…", "…heartbeats stop silently…" | Plain-language explanations |
| "Login email is synchronized with Supabase Authentication" | Changing the email also changes the email this employee signs in with |
| "Migration + professional Google Sheets sync…" | Import your existing data and keep a live Google Sheet copy… |
| 🔓 emoji in task comments / "Saved ✓" | Plain, professional text |

The employee "location tracking" switch is now **hidden** when the organization doesn't have Field Tracking. This was a known Phase A limitation, now fixed.

---

## 3. What is pending from my side

### Blocked, waiting on your input
1. **Phase C.** Needs the **database structure CSV**. It will add organization and module checks inside your existing database functions (GPS recording, visit actions, check-in, leave). It will also stop the Android GPS service on the server side when Field Tracking is off, and move notification creation to the server.

### Ready to build next
2. **Phase E: plans and upgrades**
   - A plan editor (create and edit plans and their modules)
   - Usage limits (e.g. maximum employees)
   - An upgrade flow in Settings
   - A payment-ready structure (Razorpay), with invoices and renewals
3. **Phase F: ads**
   - A central ads configuration for the app
   - A "Remove ads" upgrade
   - Rules that keep ads away from check-in, forms, permissions and alerts
4. **Phase G: Play Store readiness**
   - Terms & Conditions page, and an account deletion request
   - A location permission disclosure screen, and background-location compliance
   - Crash and error logging, and app version / force-update checks
   - Pull-to-refresh, and a battery-optimisation guide (Xiaomi, Vivo, Oppo)
   - Resume tracking after a phone restart, and stop duplicate tracking
   - A release AAB build, and Google Mobile Ads integration
5. **Phase H: security**
   - Close the login email leak
   - Protect colleagues' bank details
   - Extend the tenant wall to core tables
   - Server-only notifications
   - Fix the shared app/website login token (random logouts)
   - Store the full database structure in GitHub
   - Cross-tenant tests on every function, and rate limiting
6. **Feature upgrades**
   - **Tasks:** kanban/list view, search, bulk actions, photo proof, team scorecard
   - **Attendance:** regularisation requests, check-out reminder, fake-GPS detection, server-side IP capture
   - **Time zones:** per-organization support
   - **Help:** updated Help page and User Guide PDF
7. **Remaining UI**
   - A few admin-only reports (Payroll, Team leave balances, Task scorecard, Field reports) still use wide tables that scroll sideways on phones. They work, but card layouts would be nicer.
   - A visual check on real devices. I cannot run a browser in my environment, so every UI change is verified by build, not by eye.

---

## 4. What is pending from your side

| Item | Guide |
|---|---|
| Fix "Could not send" notification test (2 SQL queries) and share the result | Earlier message / `PHASE2_SETUP.md` |
| Run the 2B SQL, enable Cron, set the weekly off | `PHASE2B_SETUP.md` |
| Upload 2C/2D code (including `package.json`) and test | `PHASE2C_SETUP.md`, `PHASE2D_SETUP.md` |
| Run the Phase B SQL and test registration | `PHASE_B_REPORT.md` |
| Run the Phase D SQL, add yourself to `platform_admins`, test `/system-admin` | `PHASE_D_REPORT.md` |
| **Send the database structure CSV** (unblocks Phase C) | Query in earlier message |
| Android key fingerprint in `assetlinks.json` (can wait until the Play Store phase) | `PHASE1_SETUP.md` Step 6.4 |

---

# ✅ Your action checklist: this UI round

**No database changes. Nothing to replace. No Vercel changes.**

1. Extract **`SM_HRMS-ui-polish.zip`**.
2. **GitHub → Add file → Upload files.** From inside `SM_HRMS-main`, drag:
   - **First upload:** the **`src`** folder → **Commit changes**
   - **Second upload:** the **`android-app`** and **`docs`** folders → **Commit changes**
3. **Vercel → Deployments:** wait for **Ready**.
4. **GitHub → Actions:** wait for the Android build (✅ green). It publishes **app version 1.6.0**, which installs over the old app. If the build shows ❌ red, open it, copy the error text and send it to me.
5. **Check on your phone:**
   - [ ] Open any form (e.g. **Leave → Apply**). It slides up from the bottom with a small handle.
   - [ ] The top bar shows the **screen name**, with your company name underneath.
   - [ ] Switch to **dark mode**: the phone's top and bottom bars turn dark too (app v1.6.0).
   - [ ] **Field visits:** big buttons, a **Directions** link, and a tappable phone number.
   - [ ] Turn on **airplane mode** and open the app: the "You're offline" screen appears. Turn airplane mode off, and it reconnects by itself.
6. Send me **screenshots of any screen that still looks off**, and I'll fix those next.
