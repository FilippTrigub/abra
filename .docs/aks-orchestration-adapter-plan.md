# AKS Orchestration Adapter Plan

## Goal

Replace the current mock orchestration adapter with a real backend adapter that manages Abra runtimes on AKS while keeping the existing platform contract intact:

- durable deployment record first
- async orchestration dispatch
- operation status polling
- dashboard-visible step history and terminal states

This plan covers the adapter boundary only. It does not implement the AKS runtime objects themselves.

## Current Contract To Preserve

The platform already expects this flow:

1. `submitDeploymentRequest()` validates input and creates a deployment record.
2. `dispatchDeploymentRequest()` converts that record into an orchestration action.
3. `syncDeploymentStatusForUser()` polls the backend and persists the latest status.
4. The dashboard reads normalized deployment data and operation metadata.

The existing orchestration API also exposes a generic operation endpoint:

- `POST /api/orchestration/operations`
- `GET /api/orchestration/operations/[operationId]`

The new adapter should preserve that surface so the dashboard does not need a broad rewrite.

## Adapter Shape

Keep the existing adapter interface, but replace the mock implementation with an AKS-backed adapter.

### Interface

`OrchestrationAdapter` should continue to expose:

- `create(input)`
- `update(input)`
- `restart(input)`
- `destroy(input)`
- `getStatus(operationId)`

### Real Adapter Responsibilities

The AKS adapter should:

1. translate orchestration inputs into Kubernetes operations
2. create or update the Kubernetes resources for a user runtime
3. persist operation state durably
4. expose polling-friendly status and step history
5. return a stable resource handle for the deployed runtime

## Lifecycle Phases

Each operation should be modeled as a durable state machine.

Recommended phases:

1. `queued`
2. `provisioning`
3. `creating_workload`
4. `hydrating_state`
5. `starting_runtime`
6. `registering_route`
7. `running`
8. terminal: `succeeded` / `failed`

These phases map to AKS/OpenClaw concerns:

- workload creation
- PVC attachment
- `~/.openclaw` hydration before boot
- readiness gate completion
- gateway/service registration

## Persistence Model For Operations

The mock adapter keeps operations in memory. The real adapter must not.

### Required Durable Data

Persist at least:

- `operationId`
- `requestId`
- `action`
- `target.accountId`
- `target.agentId`
- `target.deploymentId`
- `status`
- `steps[]`
- `error`
- `result`
- `pollAfterMs`
- timestamps (`createdAt`, `updatedAt`, `completedAt`)

### Recommended Storage Location

Use the platform database as the source of truth for operation records.

That keeps the dashboard polling contract stable and avoids losing operation state when the platform process restarts.

## AKS Mapping

The adapter should map orchestration actions to Kubernetes primitives:

- `create` → create or reconcile namespace-scoped runtime resources for one agent
- `update` → update desired config revision and restart/reconcile the runtime
- `restart` → restart the runtime workload without changing ownership or PVC identity
- `destroy` → remove workload resources and apply the configured PVC retention policy

The runtime resources themselves should be managed through the Kubernetes API, not via static Terraform.

## Runtime Resource Expectations

The adapter should assume each agent runtime consists of:

- one workload object for the OpenClaw instance
- one PVC backing `~/.openclaw`
- one stable internal Service
- one init-step that hydrates state before OpenClaw starts
- one readiness signal that means the runtime is actually usable

The adapter should not treat “pod exists” as equivalent to “deployment succeeded.”

## Status Sync Rules

`getStatus(operationId)` should return the latest durable operation state.

If the runtime has progressed, the adapter should:

1. refresh status from Kubernetes
2. update the persisted operation record
3. return the normalized operation object

If the runtime is gone or the operation cannot be found:

- return terminal failure only when the adapter can prove the operation failed
- otherwise preserve the last known durable status and surface a recoverable polling state

This matches the current dashboard pattern, which already expects polling and reconciliation.

## Implementation Plan

### Phase 1 — Define The Real Adapter Contract

- keep `OrchestrationAdapter` unchanged
- define AKS-backed status mappings for each operation
- define the resource handle format for an Abra runtime
- define how `pollAfterMs` is computed for queued/running states

### Phase 2 — Add Durable Operation Storage

- create a database-backed operation store
- persist operation state at create time
- update state on each sync
- preserve step history and terminal payloads

### Phase 3 — Implement The AKS Adapter

- create an AKS adapter implementation behind `getOrchestrationAdapter()`
- use the Kubernetes API to create, update, restart, and destroy runtime resources
- map Kubernetes readiness and rollout events to operation phases

### Phase 4 — Connect Runtime Reconciliation

- reconcile the `~/.openclaw` PVC and hydration flow before startup
- ensure the adapter waits for the runtime to become genuinely ready
- register a stable service handle for the OpenClaw gateway

### Phase 5 — Switch The Platform To The Real Backend

- replace the mock backend selection logic
- keep the existing API routes and dashboard polling flow
- add structured failure reporting so the dashboard can explain provisioning vs hydration vs readiness failures

## Migration Strategy

Do this in a safe order:

1. introduce durable operation persistence while still running mock operations
2. add the AKS adapter behind a feature flag or backend selector
3. run create/update/restart/destroy flows against AKS in a non-default environment
4. switch the platform default from mock to AKS only after the status contract is verified

## What Must Not Change

- the dashboard should still poll a deployment or operation status endpoint
- the platform should still create a deployment record before orchestration starts
- operation IDs must remain stable across polling requests
- terminal statuses must remain normalized for the UI

## Expected Outcome

After this plan is implemented, the platform will be able to:

- create an Abra runtime on AKS
- keep it alive during long autonomous work
- hydrate `~/.openclaw` before startup
- expose a stable operation/status model to the dashboard
- stop using in-memory mock orchestration state
