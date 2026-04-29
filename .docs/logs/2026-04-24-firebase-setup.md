# Firebase Setup Session - 2026-04-24

## Summary
Setup Firebase Auth + Firestore for the Claw Parade platform runtime.

**Status: COMPLETED / INTEGRATED** — The platform now uses Firebase Auth + Firestore as its primary app backend, while the AKS-backed orchestration adapter remains the runtime deployment backend.

---

## What Was Done

### 1. Firebase Project Setup
- Connected to existing Firebase project: `abra-89a44` (named "Abra")
- Created `firebase.json` and `.firebaserc` config files
- Created Firestore database (us-central1)
- Deployed security rules (`firestore.rules`)

### 2. Environment Configuration
- Added Firebase client config to `.env.local`:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- Added server-side service account:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

### 3. Next.js Configuration
- Added explicit env vars to `next.config.ts` for Turbopack compatibility

### 4. Build Verification
- `pnpm install` - ✅ Success
- `pnpm build` - ✅ Success (12 routes)

### 5. User Completed Manually
- Enabled Google Auth in Firebase Console
- Downloaded service account JSON and added credentials to `.env.local`

---

## Remaining Issues

No blocking Firebase integration issues remain in this session log. The earlier env-loading issue was resolved as part of the later platform integration work.

---

## Files Modified

| File | Change |
|------|--------|
| `platform/firebase.json` | Created - Firebase config |
| `platform/.firebaserc` | Created - Project aliases |
| `platform/.env.local` | Updated - Added Firebase env vars |
| `platform/next.config.ts` | Updated - Added explicit env vars |
| `platform/firestore.rules` | Already existed - deployed |

---

## Final Outcome (2026-04-29 Update)

The Firebase migration was completed, and the platform now runs with:
- **Firebase Auth + Firestore** as the application auth/data backend
- **AKS orchestration adapter** for runtime deployment operations
- **Firestore-backed durable operation storage** alongside the Firebase-backed app data model

### Files Created/Modified (AKS Path — commit `5b8f4e0`)
- `platform/src/lib/orchestration/aks-adapter.ts` (1210 lines)
- `platform/src/lib/orchestration/aks-k8s-bootstrap.ts` (209 lines)
- `platform/src/lib/orchestration/firestore-operation-store.ts` (165 lines)
- `platform/src/lib/orchestration/manifest-generator.ts` (706 lines)
- `platform/src/lib/orchestration/naming-helpers.ts` (332 lines)

### Current Platform State
| Component | Backend |
|-----------|---------|
| **Auth** | Firebase Auth (Google/GitHub) |
| **Database** | Firestore |
| **Orchestration** | AKS adapter (create/update/restart/destroy) |
| **Operation Storage** | Firestore (durable operations) |
| **Firebase** | Integrated into the running platform |

---

## Commands Used

```bash
# Firebase CLI
firebase projects:list
firebase init firestore
firebase deploy --only firestore:rules

# Platform
pnpm install
pnpm build
pnpm dev
```
