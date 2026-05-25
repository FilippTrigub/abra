# Simple AKS Migration Outstanding Completion Plan

## TL;DR
> **Summary**: Close the remaining AKS migration acceptance gaps without reopening finished Terraform or reconciliation work. Update the stale env/docs contract, rerun exactly one hosted post-fix smoke request, verify hosted and AKS control-plane behavior, capture rollback/evidence artifacts, then run the final verification wave.
> **Deliverables**:
> - Completed AKS env/documentation contract in `platform/.env.example` and `platform/README.md`
> - Post-fix hosted smoke evidence for one real AKS-backed deployment request
> - AKS control-plane inspection evidence and conditional cleanup / rollback runbook
> - Reconciled plan status with Final Verification ready to execute
> **Effort**: Short
> **Parallel**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2/3 → Task 4 → Task 5 → Task 6

## Context

### Original Request
Read `.sisyphus/handoffs/simple-aks-migration-deployment-2026-05-25.md` and the relevant documents, then formulate a plan to complete the outstanding tasks.

### Interview Summary
- The existing AKS migration plan is mostly complete; the remaining work is a closeout pass, not a redesign.
- The local stale-`queued` / direct-operation-route fix is already implemented and locally verified.
- Outstanding work is now limited to the env-doc acceptance gap, one hosted smoke rerun, AKS control-plane verification, evidence capture, rollback documentation, and the final verification wave.
- The continuation must preserve the previous discipline: submit exactly one new hosted deployment request, then perform read-only follow-up checks unless conditional cleanup of created test resources is required.

### Metis Review (gaps addressed)
- Freeze completed Terraform/output/access and AKS reconciliation work; do not re-open them unless the hosted smoke proves a new defect.
- Treat a post-fix `queued` freeze as failure, not a soft success.
- Add explicit stop conditions for missing preflight inputs, `az aks command invoke` access failures, and hosted direct-operation-route regressions.
- Remove stale mock-only wording from docs so repo documentation matches the current AKS-capable platform state.

## Work Objectives

### Core Objective
Finish the remaining acceptance gaps for the simple AKS migration by proving the hosted platform can submit one AKS-backed deployment request after the status-boundary fix, documenting the exact env contract, and capturing rollback/evidence artifacts needed for final verification.

### Deliverables
- `platform/.env.example` documents the full AKS env contract: `ORCHESTRATION_BACKEND`, `AKS_RUNTIME_IMAGE`, `AKS_RUNTIME_NAMESPACE`, `AKS_PVC_RETENTION_DAYS`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_FEDERATED_TOKEN_FILE`, plus the existing compatibility note for `ABRA_RUNTIME_IMAGE`.
- `platform/README.md` reflects that mock remains the default backend but AKS mode exists and requires the documented prod env set.
- One new hosted dashboard deployment request is submitted using the authenticated Vercel-hosted platform and resolves to either:
  - a non-500, non-stale terminal/advancing status, or
  - a durable failure with clear AKS metadata.
- AKS control-plane inspection is captured via `az aks command invoke`.
- `.sisyphus/evidence/task-5-aks-smoke.md` and `.sisyphus/evidence/task-5-rollback.txt` exist with concrete commands, results, and cleanup status.
- Final verification wave inputs are ready and the original plan status is reconciled against current evidence.

### Definition of Done (verifiable conditions with commands)
- `pnpm --dir platform typecheck` passes after the docs changes.
- `pnpm --dir platform exec vitest run src/__tests__/deployment-sync-durable-read.test.ts src/__tests__/orchestration-operation-route.test.ts` passes.
- `platform/.env.example` contains all required AKS env variable names.
- `platform/README.md` no longer states that no real backend exists; it instead documents mock default + AKS runtime requirements.
- Exactly one new hosted smoke request is submitted.
- Hosted inspection proves the direct operation route no longer returns a bare durable `500` for the new smoke request.
- AKS control-plane evidence exists, even if it reports “No resources found”.
- Rollback / cleanup commands are recorded and, if smoke-created resources exist, cleanup result is captured.

### Must Have
- One-request-only hosted smoke discipline.
- Read-only hosted follow-up after submission, except conditional cleanup of smoke-created resources.
- No new Terraform module work unless the hosted smoke demonstrates a brand-new infra defect.
- Evidence files under `.sisyphus/evidence/` for each remaining acceptance gap.

### Must NOT Have
- No second hosted smoke request unless the user explicitly approves after a new defect is found.
- No Terraform re-apply, state surgery, or Vercel project reconfiguration as part of this closeout plan unless the smoke preflight proves an env mismatch.
- No secrets written into repo-tracked files or evidence files.
- No ambiguous success criteria such as “looks better” or “seems fixed”.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after using the already-existing targeted regression surface.
- QA policy: Every task includes agent-executed scenarios with evidence files.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`
- Validation stack:
  - Platform: `pnpm --dir platform typecheck`
  - Targeted regression: `pnpm --dir platform exec vitest run src/__tests__/deployment-sync-durable-read.test.ts src/__tests__/orchestration-operation-route.test.ts`
  - Hosted smoke: Playwright-authenticated dashboard submission + authenticated fetch to hosted status routes
  - AKS control plane: `az aks command invoke -g abra-rg-foundation -n abra-aks -c "kubectl get pvc,svc,statefulset,pod -n abra -o wide" -o json`

## Execution Strategy

### Parallel Execution Waves
Wave 1: Task 1 docs contract, Task 2 local regression gate, Task 3 hosted smoke preflight pack.
Wave 2: Task 4 hosted smoke execution and hosted route inspection, Task 5 AKS control-plane inspection + conditional cleanup, Task 6 rollback/runbook + source-of-truth reconciliation.

### Dependency Matrix (full, all tasks)
- Task 1 blocks Task 6.
- Task 2 blocks Task 4.
- Task 3 blocks Task 4 and Task 5.
- Task 4 blocks Task 5 and Task 6.
- Task 5 blocks Task 6.
- Task 6 blocks Final Verification.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 → 3 tasks → quick, quick, unspecified-high
- Wave 2 → 3 tasks → deep, unspecified-high, writing

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Close the AKS env contract and README drift

  **What to do**: Update `platform/.env.example` so it includes the missing AKS variables exactly as the running platform expects: `ORCHESTRATION_BACKEND`, `AKS_RUNTIME_IMAGE`, `AKS_RUNTIME_NAMESPACE`, `AKS_PVC_RETENTION_DAYS`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_FEDERATED_TOKEN_FILE`, and the existing `ABRA_RUNTIME_IMAGE` compatibility fallback note. Update `platform/README.md` so it says mock is the default backend, AKS is available for hosted/runtime testing, and the hosted AKS path requires the documented env contract. Remove or rewrite any line that still claims “No real agent backend is connected.”
  **Must NOT do**: Do not invent new env vars. Do not remove mock-backend documentation. Do not add secrets or real values.

  **Recommended Agent Profile**:
  - Category: `quick` - Small, explicit docs/env drift repair.
  - Skills: [] - No special skill required.
  - Omitted: [`terraform-engineer`] - This task is repo docs only.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Handoff: `.sisyphus/handoffs/simple-aks-migration-deployment-2026-05-25.md:34-47` - explicit remaining env-doc gap and outstanding acceptance work.
  - Existing plan: `.sisyphus/plans/simple-aks-migration-deployment.md:92-132` - original Task 1 contract and acceptance criteria.
  - Pattern: `platform/.env.example:30-39` - current file has image vars but lacks the full AKS contract.
  - Pattern: `platform/README.md:12-14` - current status text says AKS mode exists but still frames orchestration as mock-first.
  - Pattern: `platform/README.md:104-123` - runtime-image contract is documented but hosted AKS env requirements are incomplete and “no real backend” wording is stale.
  - API/Type: `platform/src/lib/orchestration/server.ts:18-37` - backend switch is controlled by `ORCHESTRATION_BACKEND` with supported values `mock` and `aks`.
  - API/Type: `platform/src/lib/orchestration/aks-adapter.ts:120-135` - runtime image precedence and required error message.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `platform/.env.example` contains `ORCHESTRATION_BACKEND`, `AKS_RUNTIME_IMAGE`, `AKS_RUNTIME_NAMESPACE`, `AKS_PVC_RETENTION_DAYS`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_FEDERATED_TOKEN_FILE`, and `ABRA_RUNTIME_IMAGE`.
  - [ ] `platform/README.md` states that mock is default, AKS exists, and documents the required hosted AKS env contract.
  - [ ] `platform/README.md` no longer claims there is no real backend.
  - [ ] `pnpm --dir platform typecheck` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Env and README contract is complete
    Tool: Bash
    Steps: Run `grep -nE 'ORCHESTRATION_BACKEND|AKS_RUNTIME_IMAGE|AKS_RUNTIME_NAMESPACE|AKS_PVC_RETENTION_DAYS|AZURE_TENANT_ID|AZURE_CLIENT_ID|AZURE_FEDERATED_TOKEN_FILE|ABRA_RUNTIME_IMAGE' platform/.env.example` and `grep -nE 'mock|AKS|ORCHESTRATION_BACKEND|AKS_RUNTIME_IMAGE|AKS_RUNTIME_NAMESPACE' platform/README.md`.
    Expected: All required AKS variable names appear in `.env.example`, and README output confirms mock-default + AKS-capable wording without any “no real backend” claim.
    Evidence: .sisyphus/evidence/task-1-env-docs.txt

  Scenario: Typecheck stays green after docs/env edits
    Tool: Bash
    Steps: Run `pnpm --dir platform typecheck`.
    Expected: Command exits 0.
    Evidence: .sisyphus/evidence/task-1-typecheck.txt
  ```

  **Commit**: YES | Message: `docs(platform): finalize aks env contract` | Files: `platform/.env.example`, `platform/README.md`

- [x] 2. Re-run the minimal local regression gate for the status-boundary fix

  **What to do**: Re-run only the focused checks that prove the shipped local fix still guards the exact hosted failure mode: queued deployment sync re-polling and direct operation-route error shaping. Capture evidence for both the happy path and the explicit failure-path test coverage.
  **Must NOT do**: Do not broaden this into a full-suite debugging session. Do not edit implementation unless these focused checks fail.

  **Recommended Agent Profile**:
  - Category: `quick` - Pure verification of already-implemented changes.
  - Skills: [] - Existing scripts/tests are sufficient.
  - Omitted: [`systematic-debugging`] - Only load if the focused gate actually fails.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Handoff: `.sisyphus/handoffs/simple-aks-migration-deployment-2026-05-25.md:21-26` - exactly what was fixed and which local commands already passed.
  - Learning: `.sisyphus/notepads/simple-aks-migration-deployment/learnings.md:35-42` - the prior hosted failure boundary (`queued` dashboard status + direct operation route `500`).
  - Pattern: `platform/src/lib/deployments.ts:654-799` - `syncDeploymentStatusForUser()` now re-polls live adapter state, persists live refreshes, and durably fails if live polling throws.
  - Pattern: `platform/src/app/api/orchestration/operations/[operationId]/route.ts:22-82` - durable-first read plus structured `500` response.
  - Test: `platform/src/__tests__/deployment-sync-durable-read.test.ts:104-180` - durable read / sync behavior.
  - Test: `platform/src/__tests__/orchestration-operation-route.test.ts:44-105` - durable stored operation read and structured `500` on polling error.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --dir platform exec vitest run src/__tests__/deployment-sync-durable-read.test.ts src/__tests__/orchestration-operation-route.test.ts` exits 0.
  - [ ] Evidence captures both the durable happy-path assertions and the structured failure-path assertions.
  - [ ] No implementation files are changed unless the focused gate fails.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Focused status-boundary regression gate passes
    Tool: Bash
    Steps: Run `pnpm --dir platform exec vitest run src/__tests__/deployment-sync-durable-read.test.ts src/__tests__/orchestration-operation-route.test.ts`.
    Expected: Command exits 0 and covers the deployment sync + route behavior tied to the hosted stale-queue bug.
    Evidence: .sisyphus/evidence/task-2-local-regression.txt

  Scenario: Failure path remains structured, not bare 500 behavior
    Tool: Bash
    Steps: Run `grep -nE 'ORCHESTRATION_OPERATION_STATUS_FAILED|Azure Workload Identity is not configured for Kubernetes bootstrap' platform/src/__tests__/orchestration-operation-route.test.ts`.
    Expected: The test file explicitly asserts the structured failure contract instead of a bare unshaped error.
    Evidence: .sisyphus/evidence/task-2-structured-failure.txt
  ```

  **Commit**: NO | Message: n/a | Files: verification only

- [x] 3. Prepare the hosted smoke preflight pack

  **What to do**: Before the one live request, confirm every non-secret prerequisite needed for a single clean hosted smoke execution: authenticated browser state file exists, hosted dashboard URL is reachable, required Vercel env variable names are present, exact AKS inspection command is ready, and a deterministic smoke name is chosen. Write this preflight state into evidence so the smoke task can stop immediately if any precondition is missing.
  **Must NOT do**: Do not submit a deployment request during preflight. Do not print secret values into evidence. Do not mutate Vercel envs in this task.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Hosted deployment preflight touches Vercel, Playwright auth, and evidence discipline.
  - Skills: [`playwright-cli`] - Useful for validating the hosted dashboard surface and auth state.
  - Omitted: [`terraform-engineer`] - No infra mutation or validation in this task.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Handoff: `.sisyphus/handoffs/simple-aks-migration-deployment-2026-05-25.md:43-46,79-84` - one-request-only rule, AKS control-plane command, and evidence priorities.
  - Learning: `.sisyphus/notepads/simple-aks-migration-deployment/learnings.md:21-24` - successful task-4 verification commands and `az aks command invoke` fallback.
  - Learning: `.sisyphus/notepads/simple-aks-migration-deployment/learnings.md:31-33` - hosted dashboard auth and existing Playwright auth-state file.
  - Decision: `.sisyphus/notepads/simple-aks-migration-deployment/decisions.md:13-14` - current Vercel production Azure identity/image values and one-request smoke discipline.
  - Pattern: `platform/src/app/(dashboard)/dashboard/deployment-console.tsx:169-255` - concrete form field IDs and submit button for the hosted request.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Preflight evidence proves `playwright/.auth/github.json` exists.
  - [ ] Hosted dashboard root and `/dashboard` are reachable.
  - [ ] `vercel env ls production` output shows the required AKS variable names without exposing values.
  - [ ] Evidence records the exact `az aks command invoke` command and the single smoke request name to use.
  - [ ] If any prerequisite is missing, the task stops and records the blocker instead of submitting the smoke request.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Hosted smoke preflight passes
    Tool: Bash + Playwright
    Steps: Verify `test -f playwright/.auth/github.json`; run `vercel curl /dashboard --deployment https://abra-platform.vercel.app -- --include` or the current production URL if the root domain redirects; run `vercel env ls production` and redact values; record the exact smoke name `aks-smoke-<UTC timestamp>` and the exact `az aks command invoke -g abra-rg-foundation -n abra-aks -c "kubectl get pvc,svc,statefulset,pod -n abra -o wide" -o json` command.
    Expected: All prerequisites are present and recorded without secret leakage.
    Evidence: .sisyphus/evidence/task-3-smoke-preflight.md

  Scenario: Missing preflight input blocks smoke safely
    Tool: Bash
    Steps: If any prerequisite check fails, write the failing check, exact command, and blocker classification into the same evidence file, then stop before any hosted deployment submission.
    Expected: No new smoke request is sent when preflight is incomplete.
    Evidence: .sisyphus/evidence/task-3-smoke-preflight.md
  ```

  **Commit**: NO | Message: n/a | Files: evidence only

- [x] 4. Submit exactly one hosted AKS smoke request and inspect hosted status surfaces

  **What to do**: Use the authenticated hosted dashboard to submit one new deployment request with a deterministic smoke name. Immediately after submission, perform only read-only hosted inspection: capture the queued/scheduled UI state, read the first `/api/dashboard/deployments/<deploymentId>/status` response to extract `deploymentId`, `operationId`, adapter, and result handle, then fetch `/api/orchestration/operations/<operationId>` in the authenticated browser context to prove the route is no longer a bare durable `500` for the new smoke request.
  **Must NOT do**: Do not submit a second smoke request. Do not mutate Vercel settings in this task. Do not treat a repeated stale `queued` status as success.

  **Recommended Agent Profile**:
  - Category: `deep` - End-to-end hosted verification across UI, authenticated fetches, and route inspection.
  - Skills: [`playwright-cli`] - Required for authenticated browser submission and hosted fetches.
  - Omitted: [`review-work`] - Final verification handles review separately.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 5, 6 | Blocked By: 2, 3

  **References** (executor has NO interview context - be exhaustive):
  - Handoff: `.sisyphus/handoffs/simple-aks-migration-deployment-2026-05-25.md:43-46,78-84` - one-request-only smoke rule and expected hosted checks.
  - Learning: `.sisyphus/notepads/simple-aks-migration-deployment/learnings.md:32-35` - previous hosted smoke pattern, request IDs, and `adapter: "aks"` proof.
  - Learning: `.sisyphus/notepads/simple-aks-migration-deployment/learnings.md:40-42` - latest smoke request still froze at `queued` and direct operation route stayed `500`.
  - Pattern: `platform/src/app/(dashboard)/dashboard/deployment-console.tsx:169-255` - exact form controls: `#deployment-name`, `#deployment-environment`, `#deployment-source-ref`, `#deployment-mock-outcome`, `#deployment-notes`, and the “Request deployment” button.
  - Pattern: `platform/src/app/(dashboard)/dashboard/deployment-console.tsx:290-364` - deployment feed renders request name, adapter, request ID, status badge, and result handle.
  - Pattern: `platform/src/app/(dashboard)/dashboard/actions.ts:22-105` - form submission path and success message contract.
  - Pattern: `platform/src/lib/deployments.ts:654-799` - hosted deployment status sync path that should now advance or fail durably.
  - Pattern: `platform/src/app/api/orchestration/operations/[operationId]/route.ts:22-82` - direct operation-route behavior to verify post-fix.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Exactly one new hosted smoke request is submitted.
  - [ ] Evidence captures the smoke name, `deploymentId`, `operationId`, adapter value, and any result handle/error detail returned by the hosted status flow.
  - [ ] Hosted deployment status proves the request reached adapter `aks`.
  - [ ] Hosted direct operation route for the new `operationId` returns a non-bare response (`200`, structured `404`, or structured `500` with actionable payload) rather than the previous durable opaque `500` failure mode.
  - [ ] If the smoke still stalls at `queued`, the task records that as failure evidence and stops without retrying.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: One hosted AKS smoke request reaches the AKS adapter
    Tool: Playwright
    Steps: Open `https://abra-platform.vercel.app/dashboard` using stored auth state `playwright/.auth/github.json`; fill `#deployment-name` with the preflight smoke name; select `#deployment-environment` = `preview`; fill `#deployment-source-ref` = `main`; select `#deployment-mock-outcome` = `succeeded`; fill `#deployment-notes` with `Post-fix AKS smoke verification`; click the button named `Request deployment`; wait for the success message and the first `/api/dashboard/deployments/.*/status` network response; capture its JSON to extract `deployment.id`, `orchestration.operationId`, `orchestration.adapter`, `status`, and `resultUrl`.
    Expected: Submission succeeds once, adapter is `aks`, and evidence contains the new `deploymentId` + `operationId`.
    Evidence: .sisyphus/evidence/task-5-aks-smoke.md

  Scenario: Hosted direct operation route no longer fails opaquely
    Tool: Playwright
    Steps: In the same authenticated browser context, call `fetch('/api/orchestration/operations/<operationId>', { cache: 'no-store' })`, capture the HTTP status and JSON body, and append them to the smoke evidence file.
    Expected: The response is not the previous opaque durable 500 failure mode; it returns a structured payload that can be classified as advancing, terminal, or actionable failure.
    Evidence: .sisyphus/evidence/task-5-aks-smoke.md
  ```

  **Commit**: NO | Message: n/a | Files: hosted verification only

- [x] 5. Inspect the AKS control plane and perform conditional cleanup

  **What to do**: Using the single new smoke request’s identifiers, run the documented Azure control-plane inspection command to check for `pvc`, `svc`, `statefulset`, and `pod` resources in namespace `abra`. If resources exist for the smoke request, capture them, then delete only the smoke-created resources after evidence is recorded. If no resources exist, record the empty result and skip deletion. Record the exact cleanup commands either way.
  **Must NOT do**: Do not delete unrelated resources. Do not perform cleanup before evidence is captured. Do not use local `kubectl` (it is unavailable in this workspace).

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Cloud control-plane inspection with conditional cleanup.
  - Skills: [] - Azure CLI is the primary tool.
  - Omitted: [`terraform-engineer`] - No Terraform mutation belongs here.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 6 | Blocked By: 3, 4

  **References** (executor has NO interview context - be exhaustive):
  - Handoff: `.sisyphus/handoffs/simple-aks-migration-deployment-2026-05-25.md:45-47,82-83` - required AKS verification method and evidence filenames.
  - Learning: `.sisyphus/notepads/simple-aks-migration-deployment/learnings.md:23-24,34-35,42` - exact `az aks command invoke` pattern and prior empty-namespace result.
  - Issue: `.sisyphus/notepads/simple-aks-migration-deployment/issues.md:21-28` - local `kubectl` absence and prior hosted blocker evidence.
  - Decision: `.sisyphus/notepads/simple-aks-migration-deployment/decisions.md:14` - one-request smoke discipline and read-only follow-up.
  - API/Type: `platform/src/lib/orchestration/aks-adapter.ts:138-147` - AKS result-handle format and in-cluster service route shape.

  **Acceptance Criteria** (agent-executable only):
  - [ ] AKS control-plane output is captured for the namespace after the new smoke request.
  - [ ] Evidence clearly states whether smoke-created resources exist.
  - [ ] If resources exist, cleanup commands target only the smoke-created objects and their execution result is captured.
  - [ ] If no resources exist, evidence explicitly records that cleanup was unnecessary.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: AKS control-plane inspection is captured
    Tool: Bash
    Steps: Run `az aks command invoke -g abra-rg-foundation -n abra-aks -c "kubectl get pvc,svc,statefulset,pod -n abra -o wide" -o json` and save the raw output; if needed, run a second scoped command using the smoke request name or resource handle to confirm ownership before any deletion.
    Expected: Evidence shows either the smoke-created resources or a clear `No resources found` result.
    Evidence: .sisyphus/evidence/task-5-aks-control-plane.json

  Scenario: Cleanup is safe and explicit
    Tool: Bash
    Steps: If the control-plane output contains smoke-created resources, run the exact `kubectl delete` commands through `az aks command invoke` for those objects only after recording evidence; otherwise write `No cleanup required` plus the inspected command into the rollback evidence.
    Expected: Only smoke-created resources are deleted, or a clear no-op cleanup record is produced.
    Evidence: .sisyphus/evidence/task-5-rollback.txt
  ```

  **Commit**: NO | Message: n/a | Files: evidence only

- [x] 6. Reconcile evidence, update outstanding status, and prepare final verification inputs

  **What to do**: Consolidate the docs evidence, local regression evidence, hosted smoke evidence, and AKS control-plane / rollback evidence into the source-of-truth plan state. Update the original plan checklist only for items actually proven by evidence, note any remaining blockers explicitly, and create a concise verification brief for the final review wave. If the smoke failed again, record the exact new blocker and stop before marking any implementation task complete.
  **Must NOT do**: Do not mark Task 5 or any final-verification item complete without corresponding evidence. Do not hide a repeated `queued` freeze inside an “in progress” summary.

  **Recommended Agent Profile**:
  - Category: `writing` - Evidence consolidation and source-of-truth reconciliation.
  - Skills: [] - Repo artifacts already exist.
  - Omitted: [`copywriting`] - This is operational documentation, not marketing text.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Final Verification | Blocked By: 1, 4, 5

  **References** (executor has NO interview context - be exhaustive):
  - Handoff: `.sisyphus/handoffs/simple-aks-migration-deployment-2026-05-25.md:36-47` - evidence gap and required remaining tasks.
  - Existing plan: `.sisyphus/plans/simple-aks-migration-deployment.md:261-309` - Task 5 and Final Verification checklist to reconcile.
  - Notepads: `.sisyphus/notepads/simple-aks-migration-deployment/learnings.md`, `.sisyphus/notepads/simple-aks-migration-deployment/issues.md`, `.sisyphus/notepads/simple-aks-migration-deployment/decisions.md` - continuity context and prior blocker history.
  - Evidence targets: `.sisyphus/evidence/task-1-env-docs.txt`, `.sisyphus/evidence/task-1-typecheck.txt`, `.sisyphus/evidence/task-2-local-regression.txt`, `.sisyphus/evidence/task-2-structured-failure.txt`, `.sisyphus/evidence/task-3-smoke-preflight.md`, `.sisyphus/evidence/task-5-aks-smoke.md`, `.sisyphus/evidence/task-5-aks-control-plane.json`, `.sisyphus/evidence/task-5-rollback.txt`

  **Acceptance Criteria** (agent-executable only):
  - [ ] The original plan’s remaining items are updated to match actual evidence, not assumptions.
  - [ ] A concise verification brief exists for F1–F4 with links/paths to the evidence files.
  - [ ] If smoke still fails, the brief names the exact new blocker and leaves Task 5 incomplete.
  - [ ] No final verification item is marked complete before the verification wave and user approval.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Evidence set is complete and internally consistent
    Tool: Bash
    Steps: Run `ls .sisyphus/evidence/task-1-* .sisyphus/evidence/task-2-* .sisyphus/evidence/task-3-* .sisyphus/evidence/task-5-*` and inspect the original plan file to ensure status changes match the evidence that exists.
    Expected: Every referenced evidence artifact exists and no plan checkbox is advanced without matching evidence.
    Evidence: .sisyphus/evidence/task-6-plan-reconciliation.txt

  Scenario: Repeated hosted failure is preserved as blocker, not hidden
    Tool: Bash
    Steps: If `task-5-aks-smoke.md` shows stale `queued`, opaque route failure, or missing AKS resources, write a blocker summary with exact command/result references into the verification brief instead of checking off Task 5.
    Expected: The plan remains honest about incomplete work and points the final verification wave at the exact blocker.
    Evidence: .sisyphus/evidence/task-6-verification-brief.md
  ```

  **Commit**: YES | Message: `docs(aks): capture smoke evidence and verification brief` | Files: `.sisyphus/evidence/*`, `.sisyphus/plans/simple-aks-migration-deployment.md` if status is reconciled there

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: `docs(platform): finalize aks env contract`
- No commit for preflight, hosted smoke execution, or AKS control-plane inspection itself.
- Commit 2: `docs(aks): capture smoke evidence and verification brief`
- If the hosted smoke reveals a new code defect, stop and create a separate follow-up plan before any implementation commit.

## Success Criteria
- The repo documents the AKS runtime contract accurately.
- The local regression gate for the status-boundary fix remains green.
- One hosted smoke request proves the post-fix hosted path either advances/settles correctly or fails durably with actionable evidence.
- AKS control-plane state is captured and test resources are either cleaned up or explicitly recorded as absent.
- Final verification has a complete, evidence-backed brief and no hidden blockers.
