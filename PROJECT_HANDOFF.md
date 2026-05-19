# Contract Estimator — Project Handoff

Start every new session by telling Claude Code:
> "Read PROJECT_HANDOFF.md, then [your task]."

Run Claude Code from `~/Desktop/estimator-site/` so it can read files and run git without extra path work.

---

## Project overview

A single-file general contracting estimation web tool, deployed on **Firebase Hosting**.

- **Single-file architecture:** `index.html` (~2700 lines) containing HTML, CSS, and JavaScript. Uses React 18 (UMD/CDN) + Babel standalone — no build step, no bundler.
- **Firebase project ID:** `project-general-estimator`
- **Live URL:** `https://project-general-estimator.web.app`
- **GitHub repo:** `https://github.com/jackflood24-creator/general_contract_estimator`
- **Deploy workflow:** `.github/workflows/deploy.yml` — triggers on every push to `main`, uses `FIREBASE_TOKEN` GitHub secret
- **Firebase services used:** Hosting, Realtime Database, Storage, Auth (anonymous), Cloud Functions (v2)

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
- **AI Assist** — plain English → hierarchical line items (parent category + sub-tasks with cost/labor); `✨ AI Assist` button in action bar
- **Ask AI chat** — floating `🤖 Ask AI` pill button, general construction Q&A (scope, exclusions, CSI codes, pricing)

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

### AI integration
- **Cloud Function:** `functions/index.js` — v2 `onRequest`, Node 22, `invoker: "public"` (unauthenticated allowed)
- **Secret:** `ANTHROPIC_API_KEY` stored in Google Cloud Secret Manager via `firebase functions:secrets:set`
- **Model:** `claude-haiku-4-5-20251001` (fast, cheap)
- **Routing:** Firebase Hosting rewrites `/api/claude` → Cloud Function. Client calls relative `/api/claude`
- **`callClaude(messages, system, maxTokens)`** — client-side helper in `index.html`; throws on non-OK or error response
- **AI Assist output:** Hierarchical JSON — parent `{ description, subItems[] }` where each sub has `{ description, qty, unit, materialCost, laborHours, laborRate }`. Uses regex `\[[\s\S]*\]` to extract array from response (handles extra prose)
- **`demoteToSubItem(lineId)`** — moves a line item to be a sub-item of the line above it
- If the Cloud Function needs redeploying: `firebase deploy --only functions --project project-general-estimator`
- If the API key needs rotating: `firebase functions:secrets:set ANTHROPIC_API_KEY --project project-general-estimator`

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

**Already configured and working as of 2026-05-19.**

The workflow at `.github/workflows/deploy.yml` uses `FIREBASE_TOKEN`, which is stored as a repository secret. Every push to `main` auto-deploys to Firebase. No manual `firebase deploy` needed.

If the token ever expires or needs to be rotated:
```bash
npx firebase-tools login:ci
```
Replace the `FIREBASE_TOKEN` secret at:
**GitHub repo → Settings → Secrets and variables → Actions**

---

## File layout

```
/
├── index.html                      # The entire app (~2700 lines)
├── firebase.json                   # Firebase Hosting config + /api/claude rewrite
├── .firebaserc                     # Firebase project binding (gitignored)
├── PROJECT_HANDOFF.md              # This file
├── functions/
│   ├── index.js                    # Claude proxy Cloud Function (v2, Node 22)
│   └── package.json                # firebase-functions ^7, firebase-admin ^13, node 22
└── .github/
    └── workflows/
        └── deploy.yml              # npm install functions + firebase deploy (hosting + functions)
```

---

## Recent work (2026-05-19)

### GitHub repo + auto-deploy wired up
- Initialized proper git repo at `~/Desktop/estimator-site/` (was incorrectly falling through to home-directory git root)
- Connected to `github.com/jackflood24-creator/general_contract_estimator`
- Added `.github/workflows/deploy.yml` — deploys on every push to `main` via `FIREBASE_TOKEN` secret
- `FIREBASE_TOKEN` secret added; first successful deploy confirmed 2026-05-19

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

### Claude AI integration
- Firebase Cloud Function v2 (`functions/index.js`) proxies Anthropic API — keeps key server-side
- `ANTHROPIC_API_KEY` stored in Google Cloud Secret Manager, accessed via `anthropicKey.value()`
- `invoker: "public"` required on the `onRequest` config so Firebase Hosting can reach Cloud Run (v2 functions are 403 by default without this)
- Firebase Hosting rewrites `/api/claude` → function; client uses relative URL so no hardcoded domain
- **AI Assist** (`✨ AI Assist` button): plain English scope → JSON parsed with regex (handles extra prose) → parent line items with sub-tasks. Each sub-task has `materialCost`, `laborRate`, `laborHours` all mapping to real line item fields
- **Ask AI** (`🤖 Ask AI` floating pill): chat widget for quick construction Q&A
- `demoteToSubItem(lineId)` — `↳` button on line rows moves that line under the one above it as a sub-item
- Totals bar now sticky (`position: sticky; bottom: 16px`) so running total always visible while scrolling

---

## What I want to work on next

(Fill this in when you start a new session.)
