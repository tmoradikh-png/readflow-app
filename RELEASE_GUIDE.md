# ReadFlow — Android Release Guide (Free app, Internal Testing)

App: **ReadFlow** · Package: **com.urmiaworks.readflow**
Org: Urmia Works · Free app (in‑app purchases added later)

EAS account: **tohid123** · Project: **tohid123/readflow**
(projectId `097b0b5a-db90-46b4-b434-60836687b429`)

> **Sections 0–5 below are the original first‑time setup guide.**
> **If you just want to ship a new version, read [TL;DR — Cut a NEW build](#tldr--cut-a-new-build-do-this-every-release) first.**

---

## TL;DR — Cut a NEW build (do this EVERY release)

This is the recurring routine. Follow it in order. **Each EAS build costs paid
quota, so do not skip the version‑bump and check steps.**

All commands run from `ReadFlow/mobile` on Windows PowerShell:

```powershell
cd c:\Users\Greencom\OneDrive\Documents\aiChat\ReadFlow\mobile
```

### Step 1 — Find the next free versionCode (CRITICAL — money saver)

> 🛑 **The #1 mistake: reusing a versionCode.** A `versionCode` is consumed the
> moment a build is **made** (not just when uploaded to Play). If you build with a
> code that already has a build, that build is wasted and the bundle is rejected by
> Play ("Version code N has already been used"). **Always pick a code strictly
> higher than the highest EXISTING EAS build.**

Check the highest existing build code:

```powershell
npx --yes eas-cli build:list --platform android --limit 5 --json --non-interactive `
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{JSON.parse(s).forEach(b=>console.log(b.appVersion+'/'+b.appBuildVersion+' '+b.status+' '+b.id.slice(0,8)))})"
```

The first line is the most recent build. **Next free code = highest `appBuildVersion` + 1.**
(Also see the [Build ledger](#build-ledger) at the bottom of this file.)

### Step 2 — Bump the version in two files

Set `versionCode` to the next free code and bump the version name. Both must agree.

1. `mobile/app.json`:
   - `expo.version` → e.g. `"1.0.14"`
   - `expo.ios.buildNumber` → `"14"`
   - `expo.android.versionCode` → `14`
2. `mobile/scripts/check-release-config.mjs` — update the three expected values to
   match (it hard‑checks `versionCode` and `version` so a stale bump fails loudly):
   - `android.versionCode === 14`
   - `version === "1.0.14"`
   - and their two `fail(...)` message strings.

### Step 3 — (If the icon changed) regenerate icons from the CLEAN source

> 🛑 **Do NOT re‑render the icon from SVG by hand** — that has repeatedly produced
> broken/"terrible" icons. Always start from the designer's clean PNG.

```powershell
# back up the current icons first (timestamped)
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Force "assets\_backup_icons\build_$ts" | Out-Null
Copy-Item assets\icon.png,assets\adaptive-icon.png,assets\favicon.png,assets\splash.png "assets\_backup_icons\build_$ts\"

# regenerate icon.png + adaptive-icon.png + favicon.png from the clean source
node gen-clean-icons.js
```

- Source PNG: `C:\Users\Greencom\Downloads\Icon cleanup request\uploads\PDF Reader App Design (1)\app-icon-rF-clean.png`
- `gen-clean-icons.js` produces:
  - `icon.png` — full‑bleed, red book‑spine flush to the **left edge** (for iOS/Play; no mask is applied there).
  - `adaptive-icon.png` — the **whole mark scaled to 0.82 and centered on cream** so the
    red spine stays **inside the Android adaptive safe zone** and survives the launcher
    mask. (Earlier builds put the spine at the literal edge → Android cropped it off →
    the launcher showed only "rF". The 0.82 inset fixes that.)
- **Verify before building** (Android launchers mask the icon to a circle or squircle):
  preview both masks and eyeball that the red spine survives. A quick check is to open
  `assets/adaptive-icon.png` and confirm the spine sits well inside the left margin, not at
  the pixel edge.
- `adaptiveIcon.backgroundColor` in `app.json` must stay cream `#F4ECD6` (matches the fill).

### Step 4 — Validate, then build (one paid build)

```powershell
npm run check:release    # must print "Release config check passed"
npx --yes eas-cli build -p android --profile internal --non-interactive --no-wait
```

`--no-wait` returns immediately with a build URL. Watch progress at
https://expo.dev/accounts/tohid123/projects/readflow/builds

### Step 5 — Record it & upload

1. Add a row to the [Build ledger](#build-ledger) (build id, version/code, what changed).
2. When the build finishes, **download the `.aab`** from the EAS build page.
3. Play Console → ReadFlow → **Testing → Internal testing → Create new release** →
   upload the `.aab` → Save → Review → **Roll out**.
4. Wait until the release shows **Available** to testers.

### Step 6 — Test on the phone (icon/version cache)

> The Android launcher caches the old icon and Play caches the old version. To see a
> new icon or version: **uninstall** the old ReadFlow from the phone, then **reinstall**
> from the Play internal‑testing link. A plain in‑place update may keep the old icon.

---

## 0) CRITICAL — Deploy the backend first (the app cannot work without it)

PDF text extraction, OCR, AI, and the natural voice **all run on your backend**. A released
`.aab` has no Expo dev server, so it will try `localhost` and do nothing.

**You must:**
1. Deploy `ReadFlow/backend` to a public **HTTPS** URL.
   - Render-ready files are included now: `backend/Dockerfile`, `backend/.dockerignore`,
  and split Blueprint files:
  - `render.internal.yaml` for internal testing on Render Free (dev override on)
  - `render.yaml` for public release (dev override off, production-safe default)
  - fallback equivalents for parent-repo roots: `backend/render.internal.yaml`, `backend/render.yaml`
   - In Render, create from Blueprint (or manual Docker service) and set secret env vars:
     `OPENAI_API_KEY` and `APP_KEY`.
   - Non-secret env is already documented in `render.yaml` (`AI_PROVIDER`, `OPENAI_MODEL`,
     `TTS_PROVIDER`, `TTS_MODEL`, `TTS_VOICE`, `OCR_ENABLED`, `RATE_*`, etc.).
   - **IMPORTANT: AI feature enforcement.** See `BACKEND_FEATURE_ENFORCEMENT.md` for complete details.
     - For internal testing: Use `ENTITLEMENTS_DEV_OVERRIDE=true, DEV_DEFAULT_TIER=ai_pro`
       (all testers get paid features, no RevenueCat needed).
     - For public v1: Set `ENTITLEMENTS_DEV_OVERRIDE=false` and `RC_SECRET_KEY` to your RevenueCat 
       production secret (free users cannot access AI/OCR/TTS).

2. Put the deployed backend URL and app key in `mobile/app.json`:
   - `expo.extra.apiUrl` = `https://<your-render-host>.onrender.com`
   - `expo.extra.appKey` = same value as backend `APP_KEY`
   - Both can also be supplied via `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_APP_KEY`.
3. Rebuild the `.aab` (below).

> For internal testing only, you *can* run the backend on your PC and use a tunnel
> (e.g. `cloudflared tunnel --url http://localhost:4000`) and paste that HTTPS URL into
> `extra.apiUrl` (and set `extra.appKey` if APP_KEY is enabled). Fine for testing,
> not for production.

### Render quick setup (Internal Testing on Free tier)
1. Push this repo to GitHub (if not already).
2. Render dashboard → **New +** → **Blueprint** → connect repo.
3. Choose `render.internal.yaml` (or `backend/render.internal.yaml` if repo root is parent workspace).
4. Confirm service builds Docker image and uses Free plan.
5. Add secret env vars in Render service settings:
   - `OPENAI_API_KEY`: your OpenAI key
   - `APP_KEY`: random long secret string (same one you put in mobile `extra.appKey`)
   - **Do NOT set `RC_SECRET_KEY` yet** (internal testing uses dev override)
6. Wait for deploy success, then verify:
   - `GET https://<service>.onrender.com/api/health` returns `{ ok: true, ... }`
7. Test the enforcement:
   - Free user (no auth) accessing AI should get 402: `curl -X POST https://<service>.onrender.com/api/ai -H "Content-Type: application/json" -d '{"task":"summary","text":"test","language":"en"}'`
   - See `BACKEND_FEATURE_ENFORCEMENT.md` for full testing suite.

### Render upgrade for public v1 (Starter/Standard tier)
Before public release, upgrade the Render plan and disable dev override:
1. Deploy with `render.yaml` (or `backend/render.yaml` if repo root is parent workspace).
2. Confirm `ENTITLEMENTS_DEV_OVERRIDE=false`.
3. Set `RC_SECRET_KEY` to your RevenueCat production secret.
4. Use Starter or Standard plan for production reliability.
5. Re-deploy. Now only users with active RevenueCat subscriptions can access AI/OCR/TTS.

---

## 1) Build the Android App Bundle (.aab)

Already configured in `mobile/eas.json` (profile `internal` → `app-bundle`, release build).

```powershell
cd ReadFlow/mobile
npm install -g eas-cli      # if not installed
eas login                   # your Expo account
eas build:configure         # first time only, links the project
eas build -p android --profile internal
```

- EAS creates and stores a **release keystore** for you (recommended). Say **yes** to let EAS
  manage signing. Back it up later via `eas credentials`.
- The result is a downloadable **.aab** (release, signed). No debug build is produced.

Confirmations (all already set in `app.json`):
- ✅ applicationId / package: `com.urmiaworks.readflow` (permanent once uploaded)
- ✅ versionCode: `1` · versionName: `1.0.0`
- ✅ Release signing: EAS‑managed keystore (or Play App Signing)
- ✅ Target SDK: Expo SDK 54 → targetSdk 35 (Play‑accepted)
- ✅ Permissions: `INTERNET` only (no location / contacts / SMS)
- ✅ No debug build (internal profile is a release app‑bundle)

---

## 2) Upload to Internal Testing

Play Console → your app → **Testing → Internal testing → Create new release**.
- Upload the `.aab`.
- Add testers (an email list or a Google Group). Save → Review → **Roll out**.
- Share the opt‑in link with your testers; they install via Play.

(Optional CLI submit: `eas submit -p android --profile internal` after configuring a Google
service‑account key in Play Console → Setup → API access.)

---

## 3) Fill out the required Play Console sections

### Store listing  (Main store listing)
- **App name:** ReadFlow
- **Short description (≤80 chars):** "Turn any PDF into a natural‑voice audiobook. Read along, hands‑free."
- **Full description:** Describe: import PDFs, read‑aloud with natural or device voice,
  OCR for scanned PDFs, follows along and remembers your place, adjustable font/spacing/speed.
  Do **not** promise "free AI forever" or unlimited anything (avoid misleading claims).
- **App icon:** 512×512 PNG (export from `assets/icon.png`).
- **Feature graphic:** 1024×500 PNG.
- **Phone screenshots:** 2–8, 16:9 or 9:16 (use the app on your S10).
- **Category:** Books & Reference. **Tags:** reading, audiobook, accessibility.
- **Contact email:** support@urmiaworks.com.

### App content (Policy → App content) — complete every item:

**Privacy policy**
- Provide a public URL: `https://urmiaworks.com/readflow/privacy` (must be live before review).
- It must state what you collect (PDF text is sent to your server for processing & to OpenAI
  for AI/voice), that you don't sell data, and how to contact you.

**Data safety** (Play form)
- Data collected/shared: declare **Files/Docs** — the PDF content is sent to your server and to
  OpenAI to generate text/audio. Mark it as **processed**, not sold.
- If you log nothing personal and store no accounts, say so. Be honest and minimal.
- Security: data encrypted in transit (HTTPS) ✓. Provide a way to request deletion (email).

**Content rating** (questionnaire)
- Category: Reference/Books. Answer "No" to violence/sexual/gambling/etc. → likely **Everyone**.

**Target audience and content**
- Target age: **18+** (or 13+) to avoid the stricter Families policy for v1. Do **not** target
  children. Confirm the app isn't designed for kids.

**Ads**
- Declare **No, my app does not contain ads** (you're not shipping ads in v1).

**App access**
- If all features are usable without login (they are), choose **"All functionality is available
  without special access"**. If anything were gated, you'd provide test credentials here.

**Government apps / Financial / Health:** No to all (no medical/health claims).

**News app:** No.

### Production countries / availability
- For internal testing, pick the countries where testers live. For later production, select
  the countries you want to distribute in.

---

## 4) Policy‑safe checklist for v1 (intentionally minimal)

- ✅ No subscriptions / no in‑app purchases yet.
- ✅ No AI paid limits / paywall (paywall code is inert; `ENFORCE_FREE_LIMIT=false`).
- ✅ Permissions: INTERNET only. No background location, contacts, SMS, call log.
- ✅ No medical/health claims. No misleading "free AI" wording in the listing.
- ✅ Core features shipped: PDF import · read‑aloud (device + natural voice) · OCR fallback ·
  remembers reading position · font/spacing/speed settings · privacy policy · support contact.

Add payments + AI usage limits **after** this first stable release and after the backend
billing/rate‑limiting is proven in production.

---

## 5) Quick command reference

```powershell
# regenerate the rF icon from the clean source PNG (NOT from SVG)
cd ReadFlow/mobile; node gen-clean-icons.js

# show the highest existing Android build code (next free code = that + 1)
npx --yes eas-cli build:list --platform android --limit 5 --json --non-interactive

# validate public release config before building (checks versionCode/version/apiUrl/appKey)
npm run check:release

# build the release .aab for internal testing (one paid build)
npx --yes eas-cli build -p android --profile internal --non-interactive --no-wait

# (optional) submit straight to the Play internal track
eas submit -p android --profile internal
```

```powershell
# backend local smoke test (with app key enforcement enabled)
cd ReadFlow/backend
$env:APP_KEY = "your-secret"
npm run dev
# then call /api/health and verify protected routes need x-app-key
```

---

## Build ledger

Append a row **every** time you start a build. `versionCode` must always increase and
must never be reused (a code is consumed the moment a build is made — see Step 1).

| versionCode | versionName | EAS build id | Status | What changed |
| ----------- | ----------- | ------------ | ------ | ------------ |
| 9  | 1.0.9  | c5842302 | finished (code rejected by Play, already used) | bold icon |
| 10 | 1.0.10 | a24eb33c | finished (code rejected by Play, already used) | bold icon |
| 11 | 1.0.11 | c1e1f64e | finished | bold icon |
| 12 | 1.0.12 | 47e0e2d5 | finished | designer's exact `app-icon-rF.png` |
| 13 | 1.0.13 | 8f8723ce | finished | controls redesign + import progress |
| 13 | 1.0.13 | f2511def | ⚠ **wasted** — code 13 reused | settings ▴ always visible + AI voice spotlight/promo |
| 14 | 1.0.14 | 929c203d | finished | clean‑source icon fix (spine survives mask) + the above UX |
| 15 | 1.0.15 | 34cd381c | building | finished reader design + AI voice sync/tail fix + exact clean icon |

**Next free versionCode: 16.**

### Lessons baked into this guide (do not relearn the hard way)
- **Never reuse a versionCode.** Build `f2511def` reused code 13 → a paid build was
  wasted and the bundle was unusable. Always run the `build:list` check (Step 1) and pick
  highest + 1.
- **Bump in BOTH `app.json` and `check-release-config.mjs`**, then run `npm run check:release`
  before building — it fails loudly if they disagree.
- **Icons come from the clean source PNG via `gen-clean-icons.js`**, never hand‑rendered from
  SVG. The Android adaptive icon must keep the red spine inside the safe zone (0.82 inset),
  or the launcher mask crops it off and you see only "rF".
- **To see a new icon/version on the phone, uninstall then reinstall** — the launcher and Play
  both cache aggressively.

