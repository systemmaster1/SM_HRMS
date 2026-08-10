# SM HRMS Advanced Field Tracking v3 — Deployment

1. Run `supabase/migrations/20260810_field_tracking_v3.sql` in Supabase SQL Editor.
2. Replace/add the files from the GitHub patch at the exact same paths.
3. Commit and let Vercel deploy.
4. Owner/Admin: Field visits → Tracking setup → enable employee → choose tracking mode.
5. Employee must open HRMS on HTTPS and allow Location permission.
6. For sales users that must be visible even between visits while the app is open, choose **While HRMS app is active**.
7. For privacy-first visit-only tracking, choose **Active visit only**.
8. Validate Owner Dashboard, Field Visits, Live Map and Field Reports.

Note: Web/PWA tracking cannot guarantee 5-minute GPS while Android has fully suspended the browser/app. Guaranteed screen-off background tracking requires the native Android foreground-location phase.
