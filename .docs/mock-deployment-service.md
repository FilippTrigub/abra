# Mock Deployment Service

## Purpose

The platform currently uses a mock deployment service to let the dashboard exercise the deployment lifecycle without a real runtime backend. It accepts deployment requests from the dashboard, persists a durable deployment record, dispatches a mock orchestration operation, and surfaces status transitions back to the UI.

This document describes the service as it exists today and outlines what should be preserved when we realize it as a fuller service in the next step.

## Current responsibilities

The current mock deployment service is split across three layers:

1. **Dashboard request + polling UI**
   - `platform/src/app/(dashboard)/dashboard/deployment-console.tsx`
   - Renders the deployment form, shows persisted deployments, and polls active deployments through `/api/dashboard/deployments/[deploymentId]/status` when status is `queued` or `running` and an `operationId` exists (`deployment-console.tsx:52-124`).

2. **Deployment persistence + orchestration bridge**
   - `platform/src/app/(dashboard)/dashboard/actions.ts`
   - `platform/src/lib/deployments.ts`
   - Validates form data, creates a deployment record, and schedules async dispatch to orchestration using `after()` (`actions.ts:22-105`).

3. **Mock orchestration backend**
   - `platform/src/lib/orchestration/server.ts`
   - `platform/src/lib/orchestration/mock-adapter.ts`
   - `platform/src/lib/orchestration/mock-store.ts`
   - Uses a mock adapter selected by `ORCHESTRATION_BACKEND` (default `mock`) and an in-memory operation store to synthesize queued/running/terminal states (`server.ts:10-42`, `mock-adapter.ts:7-28`, `mock-store.ts:168-244`).

## Request lifecycle

### 1. Dashboard submission

The dashboard form collects:

- `name`
- `environment`
- `sourceRef`
- `notes`
- `mockOutcome`

See `deployment-console.tsx:169-255` and `actions.ts:36-41`.

`submitDeploymentRequest()` validates those fields, then calls `createDeploymentRecord()` with the authenticated user id and request payload (`actions.ts:83-92`).

### 2. Durable deployment record creation

`createDeploymentRecord()` constructs a request envelope with an orchestration request id and an initial last-known status of `queued` (`deployments.ts:483-491`).

Persistence behavior:

- **Database path**: if an account scope exists, the deployment is written to Firestore at `accounts/{accountScope}/deployments/{deploymentId}` (`deployments.ts:504-541`).
- **Memory fallback**: if account storage is unavailable, a deployment is stored in an in-memory deployment map keyed by deployment id (`deployments.ts:543-567`).

The persisted deployment shape returned to the UI is normalized into `DashboardDeployment` by `toDashboardDeployment()` (`deployments.ts:175-239`).

### 3. Async orchestration dispatch

After the deployment record is created, the server action schedules `dispatchDeploymentRequest()` using `after()` so orchestration work does not block the form response (`actions.ts:94-96`).

`dispatchDeploymentRequest()` reads the deployment record, builds an orchestration input, and dispatches a `create` action through the selected orchestration adapter (`deployments.ts:575-619`).

The mock adapter receives:

- `requestId`
- `target.accountId`
- `target.deploymentId`
- payload (`name`, `environment`, `sourceRef`, `notes`)
- `mockBehavior.outcome`

This is where the dashboard's `Mock outcome` field becomes the desired terminal status (`deployments.ts:282-297`, `deployments.ts:583-600`).

### 4. Mock operation execution

The server selects the mock adapter via `getOrchestrationAdapter()` (`server.ts:10-24`).

The adapter creates a mock operation record in an in-memory `Map` (`mock-store.ts:24`, `mock-store.ts:168-183`). That record stores:

- action
- original orchestration input
- creation time in ms
- desired outcome (`succeeded` or `failed`)

The mock operation status is time-based:

- `< 800ms` → `queued`
- `< 1600ms` → `running`
- `>= 1600ms` → terminal status derived from `outcome`

See `mock-store.ts:11-14`, `mock-store.ts:85-98`, and `mock-store.ts:213-244`.

### 5. Dashboard polling and status sync

The client polls `/api/dashboard/deployments/{deploymentId}/status` while deployments are active (`deployment-console.tsx:88-124`).

That route calls `syncDeploymentStatusForUser()` and returns the normalized deployment JSON (`status/route.ts:5-45`).

`syncDeploymentStatusForUser()` handles three cases (`deployments.ts:642-699`):

1. **No operation id or already terminal** → return deployment as-is
2. **Operation still available in adapter** → persist updated deployment state from live mock operation
3. **Mock adapter lost in-memory operation** → synthesize the mock operation from persisted deployment data and original `mockOutcome`, then persist the recovered state

That third path is important. It was added so a mock deployment requested to succeed does not incorrectly fail simply because the in-memory operation store was lost before the next sync (`deployments.ts:664-699`, `mock-store.ts:195-211`).

## Data model

### DashboardDeploymentRequest

Defined in `deployments.ts:16-22`.

```ts
{
  name: string
  environment: "preview" | "staging" | "production"
  sourceRef: string
  notes: string
  mockOutcome: "succeeded" | "failed"
}
```

### DashboardDeployment

Defined in `deployments.ts:36-54`.

Key fields:

- `status`: `queued | running | succeeded | failed`
- `persistence`: `database | memory`
- `createdAt`, `updatedAt`: normalized ISO strings
- `request`: original deployment request fields
- `orchestration`: request id, operation id, adapter, next poll delay, and last-known status

### OrchestrationOperation

Defined in `orchestration/types.ts:43-58`.

Key fields:

- `operationId`
- `adapter`
- `status`
- `pollAfterMs`
- `steps`
- `error`
- `result`

## Serialization and normalization rules

The service intentionally normalizes server-side data before it reaches client components.

- Firestore-backed deployment timestamps are converted into ISO strings before being passed into `DeploymentConsole` (`deployments.ts:203-210`)
- Request payloads are validated and normalized by `normalizePayload()` before use (`deployments.ts:116-173`)
- Unknown or malformed payloads fall back to a safe placeholder deployment record (`deployments.ts:183-196`)

This is required because Next.js Client Components cannot receive Firestore timestamp objects or other non-plain class instances directly.

## Persistence modes

There are two current persistence modes.

### Database mode

- Account exists in Firestore
- Deployments are written under `accounts/{accountScope}/deployments/{deploymentId}`
- Deployment feed is loaded from Firestore and normalized for the dashboard (`deployments.ts:287-315`)

### Memory fallback mode

- Account storage is unavailable
- Deployments are stored in `deploymentMemoryStore`
- Warnings are surfaced to the UI as resiliency-mode notices (`deployments.ts:258-263`, `deployment-console.tsx:144-153`)

## Current limitations

1. **Mock orchestration state is process-local**
   - The operation store is an in-memory `Map`
   - It is lost across process restarts and cannot be shared across runtime instances

2. **The adapter is not a true service boundary yet**
   - `MockOrchestrationAdapter` is an in-process class, not an independent deployment service

3. **Recovery is synthetic, not authoritative**
   - When the in-memory operation disappears, the app reconstructs status from persisted deployment data and elapsed time rather than reading a durable operation source

4. **The service contract is dashboard-centric**
   - The current shape is optimized for the dashboard feed and local verification, not for cross-service orchestration semantics

## What should remain true in the realized service

When we replace the current mock implementation with a fuller service, the following behaviors should remain true:

1. **Durable deployment record first**
   - A deployment request should be persisted before orchestration begins

2. **Asynchronous dispatch**
   - The dashboard request should return quickly while orchestration continues in the background

3. **Status polling contract**
   - The UI should keep polling a deployment status endpoint that returns normalized `DashboardDeployment` data

4. **Explicit terminal behavior**
   - A requested mock outcome should map deterministically to a terminal state in local/mock mode

5. **Server-side normalization**
   - Non-plain backend objects must be normalized before crossing into client-rendered React trees

## Recommended realization direction

The next-step implementation should turn the current in-process mock adapter into a more explicit service contract.

Recommended shape:

- keep `DashboardDeployment` as the dashboard-facing read model
- keep `dispatchDeploymentRequest()` as the deployment-to-orchestration bridge
- move orchestration operation state into a durable backend store or dedicated service interface
- preserve `pollAfterMs`, step history, terminal status, and result/error payloads as first-class concepts

If we keep a mock mode after realization, it should still:

- accept a requested `mockOutcome`
- persist enough state to survive reloads and process restarts
- return deterministic status progression for local verification

## Files to know

- `platform/src/app/(dashboard)/dashboard/deployment-console.tsx`
- `platform/src/app/(dashboard)/dashboard/actions.ts`
- `platform/src/lib/deployments.ts`
- `platform/src/lib/orchestration/server.ts`
- `platform/src/lib/orchestration/mock-adapter.ts`
- `platform/src/lib/orchestration/mock-store.ts`
- `platform/src/lib/orchestration/types.ts`
- `platform/src/app/api/dashboard/deployments/[deploymentId]/status/route.ts`
