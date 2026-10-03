# Background location — Play Console declaration (ready to paste)

_Matches app version 1.8.5 (14) and the Privacy Policy dated 4 October 2026 (section 3)._

## 1. Core feature that needs background location
**Field Tracking for field employees.** SM HRMS is an HRMS for organizations with sales / service / delivery staff. When an organization enables Field Tracking for an employee, the app records the employee's duty route, distance travelled (KM) and customer-visit locations so the employer can verify field work, reimburse travel and plan visits. Field employees keep the phone in a pocket with the screen off while travelling, so the route can only be recorded with background location.

## 2. Why foreground location alone is not enough
A route and KM figure need location at regular intervals across the whole duty period (default every 5 minutes). Employees drive or ride between customers with the screen off and use other apps (maps, calls). Without background access the route has gaps and the KM is wrong, which defeats the feature.

## 3. Limits that are enforced in the app
- Collected **only between Attendance IN and Attendance OUT**; the service asks the server for duty status and stops itself when the employee is off duty.
- A **persistent foreground-service notification** ("SM HRMS • Duty Tracking") is shown the whole time.
- Only for employees of organizations that turned the Field Tracking module **on**, and only if the Owner/Admin enabled tracking for that **individual** employee. Everyone else is never asked for background location.
- Visible only to the employee's organization Owner/Admin and reporting/field manager. Not sold, not used for ads, not shared with other organizations.
- Employee can revoke at any time in Android Settings; the organization can switch the module or the individual setting off.

## 4. Prominent disclosure (shown in-app before the system prompt)
**Step 1 — before "While using the app":**
> SM HRMS uses your phone's location to: record where you mark Attendance IN / OUT, when your organization requires it; check in and out of customer visits; if your organization has turned on Field Tracking for you: record your duty route and KM, also in the background with the screen off, ONLY between Attendance IN and Attendance OUT. Tracking stops when you mark Attendance OUT. Your location is visible only to authorized people in your organization (Owner/Admin and your reporting manager). You can turn this off anytime in Android Settings.  [Not now] [Continue]

**Step 2 — before "Allow all the time" (only Field Tracking employees):**
> Your organization has turned on Field Tracking for you. To record your duty route and distance (KM) even when the screen is off or you are using another app, SM HRMS needs location access "Allow all the time". Location is collected ONLY between your Attendance IN and Attendance OUT. A "Duty Tracking" notification is always visible while tracking is on. Tracking stops automatically at Attendance OUT. Only your organization's Owner/Admin and your reporting manager can see it. Your organization can switch Field Tracking off; you can change this permission anytime in Android Settings.  [Not now] [Continue]

## 5. Reviewer instructions + demo account
1. Sign in with the review account (field employee, Field Tracking ON) — create a dedicated review organization; never share a real customer's account.
2. Tap **Attendance → IN** → Step 1 disclosure → Android prompt → *While using the app*.
3. Step 2 disclosure → *Continue* → Android settings → *Allow all the time*.
4. "Duty Tracking" notification appears. Lock the screen for a few minutes.
5. Open **Field tracking / Route history** as the review **admin** account to see the route.
6. **Attendance → OUT** → notification disappears; no new points are recorded.

## 6. Video script (≤ 30 s)
Sign in → Attendance IN → Step 1 disclosure → system prompt → Step 2 disclosure → "Allow all the time" → Duty Tracking notification → screen off → admin route view → Attendance OUT → notification gone.

## 7. Data Safety form (location part)
- **Precise location** and **Approximate location**: *Collected* · *Not shared* · Purpose: **App functionality** (attendance, field visits, duty route) and **Fraud prevention, security** (attendance verification) · Processed **ephemerally: No** · **Required for some users** (employees whose organization requires location).
- Data is encrypted in transit (HTTPS). Deletion: on request via https://hrms.systemmaster.in/delete-account and through the organization admin.
