# SM HRMS: Phase 1 Fixes, Setup Guide

Is guide ke steps **isi order mein** karein. Kul time: lagbhag 30–40 minute.

---

## Kya kya fix hua hai

| # | Problem | Fix |
|---|---------|-----|
| 1 | Google Sheet midnight pe sync nahi hoti thi (`vercel.json` tha hi nahi) | `vercel.json` add kiya. Roz raat 12:00 AM IST (18:30 UTC) pe auto-sync hogi |
| 2 | Middleware cron ko `/login` pe bhej deta tha | `/api/cron` ko login check se bahar kiya, `CRON_SECRET` se protected hai |
| 3 | Sheet mein Check-in/Check-out/Distance/Joining date **blank** aate the (galat column names) | Sahi columns use kiye: `check_in`, `check_out`, `check_in_distance_m`, `joined_on`, `next_followup_at`, `day_type` |
| 4 | Sheet mein time 5:30 ghante peeche dikhta tha | Saare time IST mein format hote hain |
| 5 | 1000 rows ke baad data chupchaap kat jaata tha | Pagination lagaya, ab saara data jaata hai |
| 6 | Ek company slow ho to baaki sab timeout | Har company ka sync alag, parallel invocation mein hota hai |
| 7 | Sheet sync fail ho to tab khali reh jaata tha | Naya Apps Script v2: fail hone pe purana data wapas aa jaata hai, lock lagta hai, mobile number text rehta hai |
| 8 | Koi pata nahi chalta tha ki sync hua ya nahi | Integrations page pe **Sync history** (Nightly / Manual / Auto, rows count, error) |
| 9 | Har employee Google Sheet ka secret padh sakta tha | Secret ab `company_integrations` table mein hai, jo sirf admin padh sakta hai |
| 10 | Tasks: 1000+ rows hote hi **aaj ke tasks gayab** | Saare open tasks + last 90 din, pagination ke saath |
| 11 | Raat 12:00 se 5:30 AM tak "aaj" ki jagah kal ki date | Poore app mein IST date helper (`src/lib/date.ts`) |
| 12 | Export page: "This month" pichle mahine ki last date se start hota tha aur 1000 row limit thi | Dono fix |
| 13 | Attendance selfie aur employee documents (Aadhaar/PAN) **public link** se koi bhi dekh sakta tha | Bucket private kiye; sirf employee, admin aur reporting manager signed link se dekh sakte hain |
| 14 | Service worker purana HR data dikha sakta tha | Ab sirf static files cache hoti hain |
| 15 | APK, User Guide PDF, assetlinks bina login ke nahi khulte the | Public kar diye |
| 16 | Har APK alag key se sign hota tha, isliye update fail ("App not installed") | Ek permanent release key (GitHub Secrets se) |
| 17 | Android app mein file upload (photo, logo, CSV, docs) kaam nahi karta tha | File chooser add kiya |
| 18 | WebView har page ko har permission de deta tha | Sirf apne domain ko, sirf camera |
| 19 | `assetlinks.json` mein package name galat tha | `in.systemmaster.hrms` kiya |
| 20 | Migration files galat order mein chalti thi (v3 pehle, v2 baad mein) | v2 file rename ki |

---

## STEP 1: Supabase SQL (code deploy karne se PEHLE)

1. Supabase Dashboard kholiye, phir **SQL Editor** mein jaiye.
2. `supabase/migrations/20260923_phase1_sync_privacy.sql` ka poora content paste karke **Run** karein.
3. Usi file ke end mein ek comment wali query hai (`select policyname ...`). Use alag se run karein.
   - Agar `attendance-photos` ya `employee-docs` ke liye `smhrms_...` ke alawa koi purani policy dikhe (jaise "Public read", "Allow all"), to use hata dein:
     ```sql
     drop policy "PURANI_POLICY_KA_NAAM" on storage.objects;
     ```
   - Ye zaroori hai. Purani broad policy rahi to photos phir bhi sab logged-in users ko dikh sakti hain.

**Optional (auto-attendance har 15 min):**
Supabase mein **Integrations → Cron → Enable** karein, phir `20260923_phase1_optional_pg_cron.sql` run karein.
(Vercel ka Hobby plan 15-min cron allow nahi karta, isliye ye Supabase mein chalega.)

---

## STEP 2: Vercel environment variable

Vercel mein **Project → Settings → Environment Variables** kholiye:

| Name | Value |
|------|-------|
| `CRON_SECRET` | Koi bhi lamba random text, kam se kam 32 characters. Jaise password generator se banaya hua. |
| `SUPABASE_SERVICE_ROLE_KEY` | Pehle se hona chahiye. Check kar lein. |

Vercel `CRON_SECRET` ko cron call ke saath khud bhejta hai. Aapko kahin aur paste nahi karna.

---

## STEP 3: Code deploy

1. Zip ki files apne repo mein replace karein. Ya `phase1.patch` ko `git apply phase1.patch` se lagayein.
2. `git push`. Vercel khud deploy karega.
3. Deploy ke baad **Vercel → Project → Settings → Cron Jobs** mein `/api/cron/gsheet-backup` dikhna chahiye. Wahan **Run** dabakar turant test kar sakte hain.

> **Note:** Vercel **Hobby** plan pe cron exact 12:00 pe nahi, balki **12:00–12:59 AM ke beech kabhi bhi** chalta hai. Pro plan pe exact time pe chalta hai.

---

## STEP 4: Apps Script v2 update (har company ke liye, ek baar)

Purana script bhi chalta rahega, lekin naya zyada safe hai. Dhyan rakhein ki **URL badalna nahi chahiye**:

1. SM HRMS mein **Integrations** page kholiye aur **Copy code** dabaiye.
2. Google Sheet mein **Extensions → Apps Script** kholiye. Purana code poora delete karke naya paste karein, phir Save.
3. **Deploy → Manage deployments** mein pencil (Edit) icon dabaiye. Version mein **New version** chuniye aur **Deploy** karein.
   (Is tarah **"New deployment" mat banaiye**, warna URL badal jayega.)
4. SM HRMS mein **Sync Google Sheet now** dabaiye. **Sync history** mein green dot aana chahiye.

Check karne ke liye Sheet mein **Attendance** tab kholiye. Check in / Check out columns mein IST time dikhna chahiye.

---

## STEP 5: Cleanup SQL (sync kaam karne ke BAAD)

Jab Step 4 mein sync green ho jaye, tab `20260923_phase1_cleanup_after_deploy.sql` run karein.
Ye `companies` table se purana secret hata deta hai.

---

## STEP 6: Android release key (sirf ek baar, bahut zaroori)

### 6.1 Key banaiye (apne computer pe, Java/Android Studio installed ho)
```bash
keytool -genkeypair -v -keystore smhrms-release.jks -alias smhrms -keyalg RSA -keysize 2048 -validity 10000
```
Ye password maangega. Use yaad rakhein.

> ⚠️ **`smhrms-release.jks` aur uska password 2–3 safe jagah backup karein** (Google Drive + pen drive). Ye file kho gayi to app ka update **kabhi** nahi bhej paayenge. Har user ko app uninstall karke naya install karna padega.

### 6.2 Base64 banaiye
- **Linux/Mac:** `base64 -w0 smhrms-release.jks > ks.txt` (Mac pe `-w0` hata dein)
- **Windows PowerShell:**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("smhrms-release.jks")) | Out-File ks.txt -Encoding ascii
  ```

### 6.3 GitHub Secrets
GitHub repo mein **Settings → Secrets and variables → Actions → New repository secret** kholiye aur ye add karein:

| Secret | Value |
|--------|-------|
| `ANDROID_KEYSTORE_BASE64` | `ks.txt` ka poora content |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `smhrms` |
| `ANDROID_KEY_PASSWORD` | key password (agar alag nahi rakha to wahi keystore password) |

### 6.4 assetlinks.json
```bash
keytool -list -v -keystore smhrms-release.jks -alias smhrms
```
Output mein `SHA256:` wali line (colon wala format, jaise `AB:CD:...`) copy karein.
`public/.well-known/assetlinks.json` mein `REPLACE_WITH_RELEASE_KEY_SHA256_FINGERPRINT` ki jagah paste karke push karein.

### 6.5 Users ko batana hai (sirf is ek baar)
Purane APK har baar alag random key se sign hote the, isliye naya APK unke upar update nahi ho sakta.
**Sabhi employees ko ek baar purani app uninstall karke naya APK install karna hoga.** Data server pe hai, isliye kuch delete nahi hoga. Sirf dobara login karna padega.
Iske baad aage ke saare updates seedhe install ho jayenge.

---

## STEP 7: Testing checklist

- [ ] Logout karke `https://hrms.systemmaster.in/downloads/SM-HRMS.apk` kholiye. APK download hona chahiye, login page nahi aana chahiye.
- [ ] Integrations mein **Sync now** karein: green status aaye, aur Sheet mein check-in time IST mein ho.
- [ ] Vercel Cron Jobs mein **Run** karein, Sync history mein "Nightly" entry aani chahiye.
- [ ] Agle din subah Sync history mein raat ki "Nightly" entry check karein.
- [ ] Attendance: nayi check-in selfie dikhe. Purani selfie bhi dikhe (purane links khud convert ho jaate hain).
- [ ] Browser mein purana selfie public link seedha kholiye. Ab error aana chahiye (matlab private ho gaya).
- [ ] Employee login se kisi doosre employee ki selfie/document **nahi** khulna chahiye.
- [ ] Tasks page: aaj ke tasks dikhen.
- [ ] Android app: Profile photo upload aur Task CSV import mein file picker khule.
- [ ] Android app: Attendance selfie camera kaam kare.

---

## Changed files

```
vercel.json                                             (naya)
src/middleware.ts
src/lib/supabase/middleware.ts
src/lib/date.ts                                         (naya)
src/lib/supabase/fetch-all.ts                           (naya)
src/lib/storage.ts                                      (naya)
src/components/PrivateFile.tsx                          (naya)
src/lib/gsheet-backup.ts                                (poora naya)
src/lib/csv.ts
src/app/api/cron/gsheet-backup/route.ts
src/app/api/cron/auto-attendance/route.ts
src/app/api/integrations/gsheet-backup/route.ts
src/app/(app)/integrations/page.tsx
src/app/(app)/tasks/page.tsx
src/app/(app)/attendance/page.tsx
src/app/(app)/export/page.tsx
src/app/(app)/dashboard/page.tsx
src/app/(app)/holidays/page.tsx
src/app/(app)/field-reports/page.tsx
src/app/(app)/field-visits/page.tsx
src/components/EmployeeDetail.tsx
public/sw.js
public/.well-known/assetlinks.json
android-app/app/build.gradle.kts
android-app/app/src/main/java/in/systemmaster/hrms/MainActivity.kt
.github/workflows/android-apk.yml
supabase/migrations/20260923_phase1_sync_privacy.sql    (naya)
supabase/migrations/20260923_phase1_cleanup_after_deploy.sql (naya)
supabase/migrations/20260923_phase1_optional_pg_cron.sql (naya)
supabase/migrations/20260810_professional_field_tracking_v2.sql → 20260810_field_tracking_v2_professional.sql (rename)
```
