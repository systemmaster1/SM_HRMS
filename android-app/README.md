# SM HRMS Android

Native Android shell for `https://hrms.systemmaster.in` with a foreground location service for authorized duty-time field tracking.

## Development
Open `android-app` in Android Studio, use JDK 17, sync Gradle and run.

## Direct APK
The repository workflow `.github/workflows/android-apk.yml` builds an installable debug-signed APK and publishes it as `SM-HRMS.apk` in a GitHub Release. This is suitable for internal/direct distribution. Before Play Store publication, configure a production signing key and Play App Signing.

## Tracking boundary
The native service calls the existing Supabase `is_employee_on_duty_v7` RPC before storing GPS and stops when Attendance OUT is detected. The server remains the timestamp authority.
