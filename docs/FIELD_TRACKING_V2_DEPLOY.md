# SM HRMS Professional Field Tracking v2

1. First run `supabase/migrations/20260810_field_force_upgrade.sql` if it has not already been run.
2. Run `supabase/migrations/20260810_professional_field_tracking_v2.sql`.
3. Replace the listed GitHub files from the patch ZIP.
4. Deploy to Vercel.
5. Login as Owner/Admin → Field Operations → Tracking setup → enable only Sales/Field employees.
6. Test one employee visit: Accept → Start travel → keep PWA open → confirm live location and event timeline from Owner account.

Note: Web/PWA background GPS is subject to Android/browser restrictions. For reliable screen-off/background tracking, add the Capacitor Android foreground location service as a separate native release phase.
