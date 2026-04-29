# Firebase Migration Outline for Platform

## Status: DEPRIORITIZED

The Firebase migration plan is **no longer the active path**. Instead, the platform implemented a **real AKS-backed orchestration adapter** (commit `5b8f4e0`) while keeping the existing Supabase Auth + Postgres foundation intact.

The Firebase setup work (`.docs/logs/2026-04-24-firebase-setup.md`) was partially completed but not integrated. The platform continues to use Supabase as its primary backend.

---

## Original Goal
Replace the current **Supabase Auth + Supabase Postgres** platform foundation with **Firebase Auth + Firebase database** while preserving the current product surface:
- landing page
- sign-in flow
- dashboard shell
- deployment flow
- settings surface

## Recommended Firebase Stack
- **Auth**: Firebase Authentication
- **Database**: Firestore
- **Optional server logic**: Firebase Admin SDK in server routes/actions

Firestore is the most natural replacement if the goal is to move away from Supabase entirely. If strict relational behavior is still required, reconsider whether Firebase is actually the right target.

## Major Workstreams

### 1. Replace Authentication
Current platform auth relies on:
- Supabase SSR auth helpers
- Google/GitHub OAuth
- server-side user validation in dashboard/API routes
- auth callback exchange flow

Needed migration work:
- enable **Google** and **GitHub** providers in Firebase Auth
- replace Supabase client/server auth helpers with Firebase equivalents
- implement server-side session verification for Next.js App Router
- replace callback/sign-in/sign-out flows
- update route guards for dashboard and API endpoints

### 2. Replace Data Model
Current data model is relational and schema-based:
- `platform.platform_account`
- `platform.platform_agent`
- `platform.platform_deployment`
- `platform.platform_settings`

Needed migration work:
- redesign these as Firestore collections/documents
- define ownership model around Firebase `uid`

Likely Firestore structure:
- `accounts/{uid}`
- `accounts/{uid}/agents/{agentId}`
- `accounts/{uid}/deployments/{deploymentId}`
- `accounts/{uid}/settings/current`

### 3. Replace Authorization Rules
Current platform security relies on Postgres RLS.

Needed migration work:
- translate ownership constraints into **Firestore Security Rules**
- enforce per-user document access with `request.auth.uid`
- audit all current ownership assumptions in account/deployment/settings flows

### 4. Rewrite Persistence Services
The UI can mostly stay intact, but the service layer must change.

Primary impact areas:
- `platform/src/lib/auth/*`
- `platform/src/lib/platform-account.ts`
- `platform/src/lib/deployments.ts`
- `platform/src/lib/settings/*`
- API routes under `platform/src/app/api/*`
- dashboard/actions that currently rely on Supabase-backed persistence

### 5. Rework Bootstrap Logic
Current first-sign-in behavior creates/syncs a `platform_account` row.

Needed migration work:
- create Firebase-backed account bootstrap on first authenticated session
- define how account defaults are stored in Firestore
- preserve subscription stub semantics (`active` by default in v1)

### 6. Rework Deployment Persistence + Status Flow
Current deployment flow depends on:
- durable deployment records
- async orchestration dispatch
- polling status updates

Needed migration work:
- persist deployments in Firestore instead of Postgres
- keep orchestration adapter boundary unchanged if possible
- adapt polling/status APIs to Firestore reads/writes
- preserve graceful fallback behavior if Firebase config is unavailable

**Update (2026-04-29):** The orchestration adapter was implemented with **AKS backend** (see `.docs/aks-orchestration-adapter-plan.md`). The Firebase migration for deployments is no longer needed.

### 7. Rework Settings Persistence
Current settings flow depends on:
- typed setting definitions
- durable persistence
- local fallback behavior

Needed migration work:
- store settings snapshot in Firestore
- preserve current client/server action contract where possible
- keep local fallback behavior if desired

## Architectural Risks
- Firestore is document-oriented, not relational; some current SQL/RLS concepts will need redesign, not direct translation
- ownership/security must be re-audited carefully because Firestore rules are not equivalent to Postgres RLS
- Next.js SSR/session patterns differ substantially between Supabase and Firebase
- some current "query by relationship" flows may need denormalization

## Suggested Migration Order
1. Introduce Firebase project config and env vars
2. Replace auth/session layer
3. Implement account bootstrap in Firestore
4. Implement Firestore persistence for deployments and settings
5. Replace API route auth checks and data access
6. Implement Firestore security rules
7. Remove Supabase-specific code and SQL migration dependency
8. Run end-to-end verification of sign-in, dashboard, deployments, and settings

## Minimum Acceptance Criteria
- users can sign in with Google/GitHub via Firebase Auth
- dashboard/API routes validate authenticated users server-side
- account, deployment, and settings data persist in Firebase
- ownership/security rules prevent cross-user access
- deployment/status/settings flows still work end-to-end
- Supabase-specific auth and DB code is no longer required for platform operation

## Files Another Agent Should Inspect First
- `platform/src/lib/auth/supabase-client.ts`
- `platform/src/lib/auth/actions.ts`
- `platform/src/lib/platform-account.ts`
- `platform/src/lib/deployments.ts`
- `platform/src/lib/settings/service.ts`
- `platform/src/app/api/dashboard/**/*`
- `platform/src/app/api/orchestration/**/*`
- `platform/src/app/(dashboard)/**/*`
- `platform/scripts/schema/*.sql`

## Important Note
This is **not** a drop-in provider swap. It is a real backend migration affecting:
- authentication
- persistence
- authorization
- bootstrap logic
- API contracts

The current UI layer is reusable, but the platform data/auth foundation would need a substantial rewrite.

---

## Final Implementation (2026-04-29)

Instead of completing this Firebase migration, the platform implemented:

| Component | Status | Implementation |
|-----------|--------|-----------------|
| **Orchestration Adapter** | ✅ Complete | AKS-backed adapter (`aks-adapter.ts`) with create/update/restart/destroy flows |
| **Operation Storage** | ✅ Complete | Firestore-backed durable store (`firestore-operation-store.ts`) |
| **K8s Manifests** | ✅ Complete | StatefulSet + Service + PVC generator (`manifest-generator.ts`) |
| **Auth** | ⏸ Unchanged | Still uses Supabase Auth (Google/GitHub OAuth) |
| **Database** | ⏸ Unchanged | Still uses Supabase Postgres (`platform` schema) |
| **Firebase** | ⏸ Partial | Project created (`abra-89a44`), config files exist, NOT integrated |

### Files Created/Modified (AKS Adapter — commit `5b8f4e0`)
- `platform/src/lib/orchestration/aks-adapter.ts` (1210 lines)
- `platform/src/lib/orchestration/aks-k8s-bootstrap.ts` (209 lines)
- `platform/src/lib/orchestration/firestore-operation-store.ts` (165 lines)
- `platform/src/lib/orchestration/manifest-generator.ts` (706 lines)
- `platform/src/lib/orchestration/naming-helpers.ts` (332 lines)
- Plus 8 test files (181 tests passing)

### Firebase Setup (NOT Integrated)
- `platform/firebase.json` — Firebase project config
- `platform/.firebaserc` — Project aliases
- `platform/.env.local` — Firebase env vars (not loaded by platform)
- `platform/next.config.ts` — Added explicit Firebase env vars (unused)

The Firebase migration remains an option for future consideration but is not required for the current AKS orchestration architecture.
