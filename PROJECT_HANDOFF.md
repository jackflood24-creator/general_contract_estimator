# Contract Estimator — Project Handoff

Start every new session by telling Claude Code:
> "Read PROJECT_HANDOFF.md, then [your task]."

Run Claude Code from `~/Desktop/estimator-site/` so it can read files and run git without extra path work.

---

## Project overview

A single-file general contracting estimation web tool, deployed on **Firebase Hosting**.

- **Single-file architecture:** `index.html` (~2600 lines) containing HTML, CSS, and JavaScript. Uses React 18 (UMD/CDN) + Babel standalone — no build step, no bundler.
- **Firebase project ID:** `project-general-estimator`
- **Live URL:** `https://project-general-estimator.web.app`
- **GitHub repo:** `https://github.com/jackflood24-creator/general_contract_estimator`
- **Deploy workflow:** `.github/workflows/deploy.yml` — triggers on every push to `main`, uses `FIREBASE_TOKEN` GitHub secret
- **Firebase services used:** Hosting, Realtime Database, Storage, Auth (anonymous)

## Local workflow

```bash
~/Desktop/estimator-site/   ← git repo, push from here
python -m http.server 8000  # serve locally, open http://localhost:8000
```

Any `git push origin main` auto-deploys to Firebase.

---

## Features

- **Estimator** — line items with CSI codes, markup, tax, labor (ST/OT), sub-items, drag reorder
- **Multiple estimates** — add/rename/duplicate estimate tabs per project
- **Takeoff** — PDF upload with scale calibration, polygon/line measurement tool
- **Proposals & Documents** — media gallery (PDF, image, video) with Firebase Storage upload
- **Receipts & Invoices** — media gallery
- **Site Photos & Videos** — media gallery
- **Bid Compare** — subcontractor bid comparison with per-scope lowest highlighting, PDF attachment per sub
- **Change Orders** — change order tracking with printable view
- **Proposal Print** — formatted printable proposal with line items, qualifications, exclusions, signature block
- **Cloud Save** — saves to Firebase RTDB; share link (public read, auth-gated write)
- **Export** — Full Project `.cep` (everything) or Lightweight `.json` (no media)
- **Import** — load `.cep`/`.json` files

---

## Architecture

### Auth
Anonymous Firebase Auth (`fbAuth.signInAnonymously()`) — resolves silently on mount, no login screen. `fbUser` is always set after `authResolved = true`. No email/password auth.

### Cloud save data model
```
RTDB:
  publicEstimates/{id}       — full project data, publicly readable
  userIndex/{uid}/{id}       — per-user index (private to that uid)

Storage:
  estimates/{cloudId}/media/{fileId}_{name}   — proposal/receipt/photo media
  estimates/{cloudId}/bids/{fileId}_{name}    — sub bid PDFs
```

### Media storage
`MediaGallery` component uploads files directly to Firebase Storage. Items in state carry:
- `url` — Firebase Storage download URL (persisted to RTDB)
- `dataUrl` — local base64 preview (session-only, stripped before RTDB save by `stripDataUrls()`)
- `sizeKB` — file size for display/export estimates

`gatherProjectData()` calls `stripDataUrls()` on proposals/receipts/sitePhotos before saving to RTDB so large base64 strings never hit the database.

### State / key globals
- `fbApp`, `fbAuth`, `fbDb`, `fbStorage` — Firebase instances (init at top of script)
- `makeShortId()` — generates random 16-char alphanumeric id
- `storageUpload(path, file)` — uploads to Storage, returns download URL
- `cloudSave(id, data, uid)` / `cloudLoad(id)` / `cloudList(uid)` / `cloudDelete(id, uid)` — RTDB helpers
- `cloudId` — current estimate's cloud id (auto-generated on mount, updates URL with `?id=xxx`)

### Component tree
```
App
├── TakeoffPage          — PDF measurement tool
├── MediaGallery         — reusable for proposals/receipts/photos (accepts cloudId prop)
├── BidCompare           — subcontractor table (accepts cloudId prop for PDF upload)
└── ChangeOrderPage      — change order list + print view
```

---

## Firebase Console requirements

- **Authentication → Anonymous** must be enabled
- **Realtime Database rules:**
```json
{
  "rules": {
    "publicEstimates": {
      "$id": { ".read": true, ".write": "auth != null" }
    },
    "userIndex": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```
- **Storage rules:**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /estimates/{estimateId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## GitHub Actions setup

The workflow at `.github/workflows/deploy.yml` uses `FIREBASE_TOKEN`.

To generate the token:
```bash
npx firebase-tools login:ci
```
Copy the printed token, then add it as a repository secret:
**GitHub repo → Settings → Secrets and variables → Actions → New repository secret**
Name: `FIREBASE_TOKEN`, Value: (the token)

---

## File layout

```
/
├── index.html                      # The entire app (~2600 lines)
├── firebase.json                   # Firebase Hosting config
├── .firebaserc                     # Firebase project binding (gitignored)
├── PROJECT_HANDOFF.md              # This file
└── .github/
    └── workflows/
        └── deploy.yml              # Auto-deploy on push to main
```

---

## Recent work (2026-05-17)

### Login wall removed
- Replaced email/password auth with anonymous Firebase Auth (`signInAnonymously`)
- No login screen — app opens directly to the estimator
- `cloudId` auto-generated on mount so Save to Cloud is always ready
- Removed state: `loginMode`, `loginEmail`, `loginPassword`, `loginError`, `loginBusy`
- Removed handlers: `handleLogin`, `handleLogout`
- Removed derived flags: `isReadOnly`, `showLoginScreen`
- Removed UI: `ro-banner`, `ro-mode` CSS class, user chip, Sign Out button

### Firebase Storage for media
- Added `firebase-storage-compat.js` script tag
- `storageUpload(path, file)` helper added
- `MediaGallery` component rewritten: images compress + upload to Storage; video/PDF upload directly (no base64)
- `gatherProjectData()` calls `stripDataUrls()` before RTDB save — large files never bloat the database
- `attachPdf` in `BidCompare` now uploads to Storage instead of FileReader base64
- `MediaGallery` and `BidCompare` both accept `cloudId` prop for storage path construction

---

## What I want to work on next

(Fill this in when you start a new session.)
