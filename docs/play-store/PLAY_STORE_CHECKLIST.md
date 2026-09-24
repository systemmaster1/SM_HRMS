# SM HRMS — Google Play release checklist (Android 1.7.0)

## Build
- Package: `in.systemmaster.hrms`
- Version: 1.7.0 (versionCode 8)
- compileSdk / targetSdk: 36
- GitHub workflow builds both signed APK and signed AAB.
- Play artifact: GitHub Actions artifact `SM-HRMS-PlayStore-AAB`.

## Before upload
1. Confirm GitHub Actions secrets: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD, GOOGLE_SERVICES_JSON.
2. Run the Android workflow and download `SM-HRMS-PlayStore-AAB`.
3. Put the release signing SHA-256 certificate in `public/.well-known/assetlinks.json` and deploy the website.
4. Test login, attendance, leave, tasks, visits, camera/file upload, notifications, offline mode, dark mode and logout on a real Android phone.
5. Confirm Privacy Policy, Terms and account-deletion URLs are publicly reachable.
6. Complete Play Console App content, Data safety and background-location declaration using the drafts in this folder.
7. Upload the AAB first to Internal testing. Complete a real-device smoke test before Production.

## HOLD
AUTH-SMTP / Forgot Password email OTP remains on hold and must not be represented as complete.
