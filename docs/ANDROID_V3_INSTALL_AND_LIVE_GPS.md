# SM HRMS Android v1.2.0 — Modern APK + Live GPS rollout

## Why the previous phone showed “built for an older version of Android”
The website could still serve an older previously-published APK even after web code was updated. This patch forces a fresh Android build, verifies targetSdk 35 before publication, publishes build metadata, and disables caching for `/downloads/*`.

## Deploy
1. Replace the four patch files at their exact paths.
2. Commit to `main`.
3. GitHub → Actions → **Build & Publish Android APK** → Run workflow.
4. Do not test the old APK. Uninstall the old SM HRMS app from the phone.
5. Wait for the workflow to finish successfully and then wait for the Vercel deployment created by the APK publish commit.
6. Download again from `https://hrms.systemmaster.in/download/android`.

## Expected APK
- package: `in.systemmaster.hrms`
- version: 1.2.0
- versionCode: 3
- compileSdk/targetSdk: 35
- foreground location service type: `location`

## Live GPS test
1. Login in the Android app.
2. Allow precise location and notifications.
3. Admin must have enabled field tracking for that employee.
4. Employee Attendance IN.
5. Native foreground notification should show duty tracking active.
6. Wait for the configured interval; dashboard should change from Stale to a fresh GPS timestamp.
7. Minimize app, lock screen, move outside and wait at least two intervals.
8. Refresh manager dashboard and verify new GPS points / route.
9. Turn Location OFF; dashboard should record unavailable/stale state.
10. Turn Location ON; fresh points should resume.
11. Attendance OUT; native tracking must stop.

## Important
A website cannot silently install an APK. Android always controls the final install confirmation. For broad customer distribution and the strongest trust signal, publish the signed release through Google Play after field testing.
