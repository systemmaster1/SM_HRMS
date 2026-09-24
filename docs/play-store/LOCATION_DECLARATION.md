# Background location declaration draft

SM HRMS uses location for attendance, field visits and authorized field-employee duty tracking. Background location is relevant only when the organization has Field Tracking enabled, the employee is individually authorized, and duty/active tracking rules permit tracking. Tracking is designed to stop when the employee is off duty.

## Reviewer path
1. Sign in with the supplied review account.
2. Open Attendance and check in.
3. Open Field Visits / Field Tracking.
4. Read the prominent location disclosure before granting background access.
5. Start the authorized field-tracking flow and observe the persistent foreground-service notification.
6. Check out / stop tracking and verify that tracking stops.

## Disclosure text to use before background permission
“SM HRMS uses your location during authorized field duty to record field visits, route/distance and duty-time location updates for your organization. When Field Tracking is enabled for you, location may continue to be collected while the app is in the background during active duty. Tracking stops when your authorized duty/tracking session ends. You can review or revoke location permission in Android Settings.”

## Reviewer video script (under 30 seconds)
Show sign-in → Attendance IN → Field Tracking disclosure → Android permission screen → active tracking with persistent notification → Attendance OUT / Stop → tracking stopped.
