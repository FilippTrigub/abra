# Firebase Migration Outline for Platform

## Status: COMPLETED

The Firebase migration is now the active platform foundation.

The platform uses **Firebase Auth + Firestore** for its auth and persistence layers, while the orchestration backend is implemented through the **AKS-backed adapter** (commit `5b8f4e0`).

---

## Original Goal
Replace the former relational auth/data foundation with **Firebase Auth + Firestore** while preserving the current product surface:
- landing page
- sign-in flow
- dashboard shell
- deployment flow
- settings surface

## Recommended Firebase Stack
- **Auth**: Firebase Authentication
- **Database**: Firestore
- **Optional server logic**: Firebase Admin SDK in server routes/actions

Firestore is the active application persistence layer. Where strict relational behavior had existed in the older platform, that logic was replaced with Firebase-oriented ownership and document persistence patterns.

## Major Workstreams

### 1. Replace Authentication
Current platform auth relies on:
- Firebase Auth popup sign-in for Google/GitHub
- server-side session validation via Firebase Admin-backed cookies
- dashboard/API route guards that read the authenticated Firebase user
- an unsupported OAuth callback route that redirects users back to `/sign-in`

Completed migration work:
- enabled **Google** and **GitHub** providers in Firebase Auth
- replaced the old auth helpers with Firebase equivalents
- implemented server-side session verification for Next.js App Router
- replaced sign-in/sign-out/session flows with Firebase-backed versions
- updated route guards for dashboard and API endpoints

### 2. Replace Data Model
Current data model is relational and schema-based:
- `platform.platform_account`
- `platform.platform_agent`
- `platform.platform_deployment`
- `platform.platform_settings`

Completed migration work:
- redesigned these as Firestore collections/documents
- defined ownership around Firebase `uid`

Likely Firestore structure:
- `accounts/{uid}`
- `accounts/{uid}/agents/{agentId}`
- `accounts/{uid}/deployments/{deploymentId}`
- `accounts/{uid}/settings/current`

### 3. Replace Authorization Rules
Current platform security relies on Firebase-backed identity and Firestore persistence boundaries.

Completed migration work:
- centered ownership on the authenticated Firebase user
- preserved server-side ownership checks in account/deployment/settings flows
- aligned the active runtime with Firebase-backed auth and storage

### 4. Rewrite Persistence Services
The UI largely stayed intact while the service layer changed.

Primary impact areas:
- `platform/src/lib/auth/*`
- `platform/src/lib/platform-account.ts`
- `platform/src/lib/deployments.ts`
- `platform/src/lib/settings/*`
- API routes under `platform/src/app/api/*`
- dashboard/actions that now rely on Firebase-backed persistence

### 5. Rework Bootstrap Logic
Current first-sign-in behavior bootstraps a Firebase-backed account record.

Completed migration work:
- created Firebase-backed account bootstrap on first authenticated session
- stored account defaults in Firestore
- preserved subscription stub semantics (`active` by default in v1)

### 6. Rework Deployment Persistence + Status Flow
Current deployment flow depends on:
- durable deployment records
- async orchestration dispatch
- polling status updates

Completed migration work:
- persisted the active deployment model through Firebase-backed storage
- kept the orchestration adapter boundary intact
- kept polling/status APIs aligned with durable reads/writes
- preserved graceful fallback behavior when storage is unavailable

**Update (2026-04-29):** The orchestration adapter was implemented with the **AKS backend** (see `.docs/aks-orchestration-adapter-plan.md`) and operates alongside the Firebase-backed platform foundation.

### 7. Rework Settings Persistence
Current settings flow depends on:
- typed setting definitions
- durable persistence
- local fallback behavior

Completed migration work:
- stored the settings snapshot in Firestore
- preserved the client/server action contract
- kept local fallback behavior where needed

## Architectural Risks
- Firestore is document-oriented, not relational; some current SQL/RLS concepts will need redesign, not direct translation
- ownership/security must be re-audited carefully because Firestore rules are not equivalent to Postgres RLS
- Next.js SSR/session patterns differ substantially between provider-specific auth implementations and Firebase
- some current "query by relationship" flows may need denormalization

## Completed Migration Order
1. Introduced Firebase project config and env vars
2. Replaced the auth/session layer
3. Implemented account bootstrap in Firestore
4. Implemented Firestore persistence for deployments and settings
5. Replaced API route auth checks and data access
6. Removed tracked platform-specific legacy provider references from code/docs/config
7. Verified sign-in, dashboard, deployments, settings, tests, and builds

## Minimum Acceptance Criteria
- users can sign in with Google/GitHub via Firebase Auth
- dashboard/API routes validate authenticated users server-side
- account, deployment, and settings data persist in Firebase
- ownership/security rules prevent cross-user access
- deployment/status/settings flows still work end-to-end
- legacy provider-specific auth and DB code is no longer required for platform operation

## Files Another Agent Should Inspect First
- `platform/src/lib/auth/firebase-auth.ts`
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

The UI layer remained reusable while the platform data/auth foundation was rewritten around Firebase.

---

## Final Implementation (2026-04-29)

The platform completed the Firebase migration and also implemented:

| Component | Status | Implementation |
|-----------|--------|-----------------|
| **Orchestration Adapter** | ✅ Complete | AKS-backed adapter (`aks-adapter.ts`) with create/update/restart/destroy flows |
| **Operation Storage** | ✅ Complete | Firestore-backed durable store (`firestore-operation-store.ts`) |
| **K8s Manifests** | ✅ Complete | StatefulSet + Service + PVC generator (`manifest-generator.ts`) |
| **Auth** | ✅ Complete | Firebase Auth (Google/GitHub) with server-side session cookies |
| **Database** | ✅ Complete | Firestore-backed platform persistence |
| **Firebase** | ✅ Integrated | Project created (`abra-89a44`), config files are used by the running platform |

### Files Created/Modified (AKS Adapter — commit `5b8f4e0`)
- `platform/src/lib/orchestration/aks-adapter.ts` (1210 lines)
- `platform/src/lib/orchestration/aks-k8s-bootstrap.ts` (209 lines)
- `platform/src/lib/orchestration/firestore-operation-store.ts` (165 lines)
- `platform/src/lib/orchestration/manifest-generator.ts` (706 lines)
- `platform/src/lib/orchestration/naming-helpers.ts` (332 lines)
- Plus 8 test files (181 tests passing)

### Firebase Setup
- `platform/firebase.json` — Firebase project config
- `platform/.firebaserc` — Project aliases
- `platform/.env.local` — Firebase env vars for local platform runtime
- `platform/next.config.ts` — Firebase env exposure aligned with the platform runtime

The Firebase migration is complete and is now the baseline application backend alongside the AKS orchestration architecture.
