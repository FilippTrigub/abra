# Firebase Setup Session - 2026-04-24 (DEPRICATED)

## Summary
Setup Firebase Auth + Firestore for the Claw Parade platform, migrating from Supabase.

**Status: DEPRIORITIZED** — The platform implemented an **AKS-backed orchestration adapter** (commit `5b8f4e0`) instead, keeping Supabase Auth + Postgres as the primary backend.

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

### Env Var Not Loading (UNRESOLVED)
The dev server reports: `Missing required Firebase env var: NEXT_PUBLIC_FIREBASE_API_KEY`

**Attempted fixes:**
1. Verified env vars exist in `.env.local` - they are present
2. Added explicit env vars to `next.config.ts` - may need testing
3. Restarted dev server multiple times

**Potential causes:**
- Turbopack in Next.js 16 may handle `.env.local` differently
- Hot module reload caching old module state
- Need to test after the config changes take effect

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

The Firebase migration was **not completed**. Instead:
- **AKS orchestration adapter** was implemented (Tasks 1-6 complete)
- **Supabase Auth + Postgres** remains the platform backend
- Firebase config files exist but are **NOT integrated** into the running platform
- The orchestration adapter uses **Firestore** only for durable operation storage (`firestore-operation-store.ts`), not for the main platform data model

### Files Created/Modified (AKS Path — commit `5b8f4e0`)
- `platform/src/lib/orchestration/aks-adapter.ts` (1210 lines)
- `platform/src/lib/orchestration/aks-k8s-bootstrap.ts` (209 lines)
- `platform/src/lib/orchestration/firestore-operation-store.ts` (165 lines)
- `platform/src/lib/orchestration/manifest-generator.ts` (706 lines)
- `platform/src/lib/orchestration/naming-helpers.ts` (332 lines)

### Current Platform State
| Component | Backend |
|-----------|---------|
| **Auth** | Supabase (Google/GitHub OAuth) |
| **Database** | Supabase Postgres (`platform` schema) |
| **Orchestration** | AKS adapter (create/update/restart/destroy) |
| **Operation Storage** | Firestore (durable operations only) |
| **Firebase** | Config exists, NOT integrated |

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