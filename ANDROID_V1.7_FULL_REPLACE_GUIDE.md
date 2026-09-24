# SM HRMS Android 1.7.0 — Full Replace Guide

## What this package changes
- Android compileSdk/targetSdk 36.
- Android versionCode 8, versionName 1.7.0.
- GitHub Actions now builds both signed APK and Play Store AAB.
- First-launch camera/location permission avalanche removed; feature permissions are contextual.
- Mobile typography/spacing baseline strengthened while retaining the existing SM HRMS UI.
- Public Terms and account-deletion request pages added.
- Settings links to Privacy, Terms and account deletion added.
- Play Store preparation documents added under `docs/play-store/`.
- AUTH-SMTP / Forgot Password email OTP remains HOLD.

## Full replacement
1. Keep a backup of the current GitHub repository/branch.
2. Extract this ZIP. Open the `SM_HRMS-main` contents (the ZIP itself contains repository contents at its root).
3. In the existing GitHub repository, upload/replace the matching files and folders. Do not upload `.env` secrets or a local `google-services.json`.
4. Commit to `main`.
5. Wait for Vercel deployment and GitHub Android workflow.

## GitHub Secrets required
- ANDROID_KEYSTORE_BASE64
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD
- GOOGLE_SERVICES_JSON

Do not generate a new release key if the current installed Android app already uses the existing key. Updates must keep the same signing identity.

## Expected GitHub Actions output
- `SM-HRMS-APK` — direct install/testing APK.
- `SM-HRMS-PlayStore-AAB` — upload this artifact to Google Play Console.

## Website checks after Vercel deploy
- /privacy
- /terms
- /delete-account
- /settings (admin/owner account)

## Phone smoke test
- Fresh app launch: no camera/location permission avalanche.
- Login.
- Dashboard alignment and bottom navigation.
- Attendance IN/OUT.
- Leave form with keyboard open.
- Tasks / Visits.
- Camera when actually requested by a feature.
- Location when actually requested by a feature.
- File upload/share.
- Notification tap.
- Offline → online recovery.
- Dark mode.
- Logout.

## Play Store
Use the files under `docs/play-store/` before submitting. Upload the AAB to Internal testing first, complete real-device testing, then proceed to Production.

## Known hold
AUTH-SMTP / Forgot Password email OTP: HOLD due to external SMTP authentication failure. Existing implementation is retained.

## Build verification note
The source package was statically inspected and updated. The local execution environment used to prepare this ZIP could not finish `npm ci` within its tool timeout, and it does not have a local Gradle installation, so the final Next.js + signed Android/AAB build must be verified by your existing Vercel/GitHub Actions pipelines after upload. Do not treat the AAB as verified until the GitHub Action is green.
