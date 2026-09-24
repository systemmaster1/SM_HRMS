# SM HRMS: Phase 2 (Phone Push Notifications), Setup Guide

Iske baad jab bhi kisi employee ko task mile, leave approve/reject ho, buddy request aaye, comment ya extension request aaye, ya help-desk update ho, **uske phone pe asli notification aayega**, chahe app band ho.
Ye sab events pehle se bell icon mein aa rahe the. Ab wahi phone pe bhi jayenge. Kisi event ka code alag se nahi badla.

> **Pehle Phase 1 poora hona chahiye**, khaas kar Android release key ke 4 GitHub secrets. Unke bina naya APK nahi banega.

Kul time: lagbhag 30–40 minute.

---

## Kya kya bana hai

| Hissa | Kaam |
|------|------|
| Android app (v1.4.0) | Firebase se push aata hai. Tap karne pe seedha sahi page (jaise Tasks) khulta hai |
| Browser / PWA | Chrome, Edge, Firefox (desktop + Android) aur iPhone (Home Screen app) pe Web Push |
| Database trigger | Har naye notification pe server ko turant batata hai |
| `/api/hooks/push` | Us user ke saare phones/browsers pe push bhejta hai. Uninstall ho chuke phones ko list se hata deta hai |
| Bell icon | Ab **mobile header mein bhi dikhta hai**, turant update hota hai (Realtime), aur isme **"Send me a test notification"** button hai |
| "Turn on notifications" card | Browser pe permission maangta hai. Android app mein notifications off hon to settings kholne ka button deta hai |
| Logout | Logout karne pe us phone pe us user ke notifications aana band ho jaata hai |

---

## STEP 1: Firebase project (10 min)

1. https://console.firebase.google.com kholiye aur apne Google account se login kijiye.
2. **Create a project** dabaiye. Naam `SM HRMS` rakhiye. Google Analytics **off** kar dein, phir **Create**.
3. Project khulne pe beech mein **Android icon** (Add app) dabaiye:
   - **Android package name:** `in.systemmaster.hrms` (bilkul yahi, spelling check karein)
   - App nickname: `SM HRMS`
   - SHA-1 khali chhod dein
   - **Register app** dabaiye
4. **Download google-services.json** dabaiye. File computer pe save ho jayegi. Baaki steps pe **Next → Next → Continue to console** karte jaiye.
5. Ab upar ⚙️ **Project settings → Service accounts** tab kholiye, phir **Generate new private key → Generate key** dabaiye.
   Ek aur `.json` file download hogi (naam kuch aisa hoga: `sm-hrms-xxxxx-firebase-adminsdk-....json`).

> ⚠️ Service account wali file **password jaisi secret** hai. Ise kisi ko mat bhejiye aur GitHub pe upload mat kijiye.

---

## STEP 2: GitHub secret (Android build ke liye)

GitHub repo mein **Settings → Secrets and variables → Actions → New repository secret** kholiye:

| Name | Value |
|------|-------|
| `GOOGLE_SERVICES_JSON` | `google-services.json` ko Notepad se kholiye, **poora content** copy karke paste karein |

---

## STEP 3: Vercel environment variables

Vercel mein **sm-hrms → Settings → Environment Variables → Add Environment Variable** kholiye. Ye 4 add karein (Environments: Production **aur** Preview dono tick):

| Name | Value |
|------|-------|
| `PUSH_WEBHOOK_SECRET` | Koi naya lamba random text, jaise `SMPUSH-7fK2mQ9xL4pZ8vN3bR6tW1yC5`. **Isko note kar lein**, Step 4 mein chahiye. |
| `FIREBASE_SERVICE_ACCOUNT` | Step 1.5 wali service-account `.json` file Notepad mein kholiye, **poora content** (shuru ke `{` se aakhri `}` tak) paste karein |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `VAPID_KEYS_private.txt` file mein diya hua **public key** |
| `VAPID_PRIVATE_KEY` | Usi file mein diya hua **private key** |

(`VAPID_KEYS_private.txt` aapko chat mein alag se di gayi hai. Woh GitHub mein nahi jaani chahiye.)

---

## STEP 4: Supabase SQL

1. `supabase/migrations/20260924_phase2_push.sql` file Notepad mein kholiye.
2. Section 4 mein ye line dhoondhiye:
   ```sql
   values (1, 'https://hrms.systemmaster.in/api/hooks/push', 'PASTE_PUSH_WEBHOOK_SECRET_HERE')
   ```
   `PASTE_PUSH_WEBHOOK_SECRET_HERE` ki jagah **Step 3 wala `PUSH_WEBHOOK_SECRET`** paste karein. Quotes `' '` rehne dein.
   (Agar aapki website ka address `hrms.systemmaster.in` nahi hai to URL bhi badal dein.)
3. Poora content Supabase ke **SQL Editor** mein paste karke **Run** karein. "Success" aana chahiye.

> Agar pehle placeholder ke saath hi run ho gaya ho to koi baat nahi. Secret theek karke file dobara run kar dein. Ye safe hai.

---

## STEP 5: Code GitHub pe upload

Phase 1 ki tarah upload karein. Is baar ye files/folders badle hain:

- **Root files:** `package.json`, `package-lock.json`, `.gitignore`, `.env.example`
- **Folders:** `src`, `public`, `android-app`, `supabase`, `docs`, `.github`

`package.json` aur `package-lock.json` zaroor upload karein. Inke bina Vercel build fail hoga, kyunki naya package `web-push` add hua hai.

Upload ke baad:
1. **Vercel → Deployments** mein naya deployment "Ready" hona chahiye.
2. **GitHub → Actions** mein "Build & Publish Android APK" green ✅ hona chahiye. 5–8 minute lagte hain. Iske baad website pe naya APK (v1.4.0) aa jayega.

---

## STEP 6: Test

### Computer (Chrome / Edge)
1. Website kholiye aur login kijiye. Upar right mein **"Get alerts on this device"** card aayega. **Turn on notifications** dabaiye, phir browser mein **Allow**.
2. 🔔 Bell dabaiye aur neeche **"Send me a test notification"** dabaiye.
3. 2–5 second mein screen ke kone mein notification aana chahiye.

### Android phone
1. Naya APK install karein (`/download/android`). Phase 1 ki key wali APK pehle se installed hai to seedha update ho jayega.
2. App kholiye aur login kijiye. **Notifications allow** karein.
3. Bell dabaiye, phir **Send me a test notification**.
4. Ab app **band karke** (Home button) doosre phone/computer se us employee ko ek task assign kijiye. Phone pe notification aana chahiye, aur tap karne pe **Tasks** page khulna chahiye.

### iPhone
iPhone pe push sirf tab aata hai jab site **Home Screen pe add** ho:
Safari mein site kholiye, **Share → Add to Home Screen** dabaiye. Phir **Home Screen wale icon se** app kholiye, login kijiye aur "Turn on notifications" dabaiye. (iOS 16.4 ya naya chahiye.)

---

## Kuch kaam na kare to (troubleshooting)

Supabase SQL Editor mein ye chalaiye:

```sql
select title, created_at, pushed_at, push_result
from public.notifications order by created_at desc limit 10;
```

| `push_result` | Matlab / kya karein |
|---------------|---------------------|
| khali (NULL) | Server tak call pahunchi hi nahi. Neeche wali `net._http_response` query dekhiye |
| `no devices` | Us user ka koi phone/browser register nahi hai. App/website mein login karke notifications allow karein |
| `sent 1/1` | Server ne bhej diya ✅. Phone pe nahi dikha to phone ki notification/battery settings check karein |
| `error:FIREBASE_SERVICE_ACCOUNT not set` | Vercel mein variable nahi hai, ya add karne ke baad **Redeploy** nahi kiya |
| `error:VAPID keys not set` | Vercel mein VAPID ke 2 variables check karein, phir Redeploy |
| `error:... Google auth failed` | `FIREBASE_SERVICE_ACCOUNT` mein poora JSON paste nahi hua. Dobara paste karein |
| `error:403 SENDER_ID_MISMATCH` | `google-services.json` aur service account alag-alag Firebase project ke hain |

Server tak call pahunchi ya nahi, ye dekhne ke liye:
```sql
select status_code, error_msg, created from net._http_response order by created desc limit 5;
```
- `200` ka matlab theek hai.
- `401` ka matlab SQL wala secret aur Vercel ka `PUSH_WEBHOOK_SECRET` alag hain. Dono same karein.
- `307` ya `308` ka matlab URL galat hai (jaise `www.` laga ho). Website ka exact address daaliye.

Registered devices dekhne ke liye:
```sql
select platform, count(*) from public.push_devices group by 1;
```

### Xiaomi / Redmi / Vivo / Oppo / Realme phones
Ye brands background apps ko band kar dete hain, jisse notification der se aata hai ya nahi aata. Us phone mein:
- **Settings → Apps → SM HRMS → Battery → No restrictions / Unrestricted**
- **Autostart** ON karein (Xiaomi / Vivo / Oppo mein milta hai)
- Recent apps mein SM HRMS ko 🔒 lock kar dein

Jis app ko user ne **Force stop** kiya ho, Android use koi notification nahi deta. App ek baar kholne se theek ho jaata hai.

---

## Changed files

```
package.json, package-lock.json          (web-push package add hua)
.gitignore, .env.example                 (naye)
public/sw.js
src/middleware.ts, src/lib/supabase/middleware.ts
src/app/(app)/layout.tsx
src/app/api/hooks/push/route.ts          (naya)
src/lib/push/fcm.ts, src/lib/push/webpush.ts (naye)
src/components/NotificationBell.tsx      (naya version)
src/components/PushRegistrar.tsx         (naya)
src/components/Shell.tsx
android-app/build.gradle.kts, android-app/app/build.gradle.kts
android-app/app/src/main/AndroidManifest.xml
android-app/app/src/main/java/in/systemmaster/hrms/MainActivity.kt
android-app/app/src/main/java/in/systemmaster/hrms/NativeBridge.kt
android-app/app/src/main/java/in/systemmaster/hrms/NativePrefs.kt
android-app/app/src/main/java/in/systemmaster/hrms/PushNotifications.kt (naya)
android-app/app/src/main/java/in/systemmaster/hrms/SmPushService.kt     (naya)
android-app/app/src/main/res/drawable/ic_stat_notify.xml                (naya)
.github/workflows/android-apk.yml
supabase/migrations/20260924_phase2_push.sql (naya)
```
