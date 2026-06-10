# Simple AKS Migration and Deployment Plan

## TL;DR
> **Summary**: Finish the smallest safe AKS migration by locking the runtime contract, wiring missing Terraform/platform outputs and envs, deploying the runtime image, and smoke-testing one AKS-backed deployment.
> **Deliverables**: AKS-ready Terraform outputs/access, documented platform env contract, minimal Kubernetes runtime reconciliation, Vercel/Azure deploy steps, one real smoke test.
> **Effort**: Medium
> **Parallel**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2/3 → Task 4 → Task 5

## Context

### Original Request
Plan the remaining changes necessary for the AKS migration and deployment. Keep the plan simple. Azure CLI and Terraform are authenticated.

### Interview Summary
- User wants a simple executable plan, not a large redesign.
- The platform has already been deployed to Vercel preview.
- Azure CLI and Terraform are available for deployment execution.

### Metis Review (gaps addressed)
- Keep scope small and decision-complete.
- Define runtime image precedence before implementation.
- Do not include Postgres migration, CI/CD redesign, or broad legacy module rewrites.
- Include agent-executable Terraform/app verification and a missing-image failure check.

### Oracle Review (gaps addressed)
- Missing outputs/access can block runtime deployment.
- Runtime image source must be explicit.
- Container Apps-era modules should be ignored/deferred unless referenced.
- Validate `ORCHESTRATION_BACKEND=aks` and include one smoke path.

## Work Objectives

### Core Objective
Make the existing platform capable of creating one real AKS-backed Abra runtime using the current foundation Terraform and existing AKS adapter, without redesigning the platform.

### Deliverables
- Runtime image contract: `payload.image` wins, `AKS_RUNTIME_IMAGE` fallback, missing image fails clearly.
- Terraform prod exposes all outputs needed to configure platform/runtime deployment.
- AKS cluster can pull the Abra runtime image from ACR.
- Platform env docs include all AKS runtime variables.
- AKS adapter reconciles all Kubernetes objects it depends on for a minimal runtime.
- Terraform plan/apply and one AKS-backed orchestration smoke test are executed.

### Definition of Done
- `terraform -chdir=terraform/environments/prod fmt -check -recursive` passes.
- `terraform -chdir=terraform/environments/prod validate` passes after init.
- `terraform -chdir=terraform/environments/prod plan -var-file=prod.tfvars -out=tfplan` succeeds.
- `pnpm --dir platform typecheck` passes.
- `pnpm --dir platform test:unit` passes or targeted AKS orchestration tests pass if full unit suite is too slow.
- Vercel env contains `ORCHESTRATION_BACKEND=aks` and `AKS_RUNTIME_IMAGE=<acr-login-server>/<image>:<tag>` for the target deployment.
- One authenticated platform deployment request creates or updates AKS runtime resources and records a non-failed operation.

### Must Have
- Simple prod-only path.
- No migration of Firestore orchestration state to Postgres in this phase.
- No new multi-environment abstraction.
- No CI/CD redesign.
- No broad rewrite of old Container Apps modules unless they are referenced by active prod code.

### Must NOT Have
- No secrets committed to repo.
- No hardcoded Azure subscription IDs, Firebase secrets, or Vercel tokens.
- No manual-only acceptance criteria.
- No ambiguous runtime image selection.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed except account-level approvals if Azure/Vercel prompts require them.

- Test decision: tests-after, focused on existing platform/Terraform structure.
- QA policy: Every task has agent-executed scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves
Wave 1: Task 1 runtime contract/docs, Task 2 Terraform outputs/access, Task 3 Kubernetes reconciliation.
Wave 2: Task 4 deploy/configure Azure + Vercel, Task 5 smoke test and cleanup docs.

### Dependency Matrix
- Task 1 blocks Task 4 and Task 5.
- Task 2 blocks Task 4 and Task 5.
- Task 3 blocks Task 5.
- Task 4 blocks Task 5.

### Agent Dispatch Summary
- Wave 1: 3 tasks — quick, unspecified-high, unspecified-high.
- Wave 2: 2 tasks — unspecified-high, deep.

## TODOs

- [x] 1. Lock AKS runtime contract and env documentation

  **What to do**: Make the runtime image contract explicit: `payload.image` has highest precedence, `AKS_RUNTIME_IMAGE` is the production fallback, `ABRA_RUNTIME_IMAGE` remains compatibility fallback only if already supported, and missing image returns the current clear error. Update `platform/.env.example`, `platform/README.md`, and any deployment docs to document `ORCHESTRATION_BACKEND=aks`, `AKS_RUNTIME_IMAGE`, `AKS_RUNTIME_NAMESPACE`, `AKS_PVC_RETENTION_DAYS`, and Azure workload identity vars.

  **Must NOT do**: Do not introduce a new config system. Do not remove mock backend support.

  **Recommended Agent Profile**:
  - Category: `quick` - Small docs/env contract update plus targeted assertion.
  - Skills: [] - No special skill required.
  - Omitted: `terraform-engineer` - No Terraform changes in this task.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5 | Blocked By: none

  **References**:
  - Pattern: `platform/src/lib/orchestration/server.ts:18-37` - backend selection contract.
  - Pattern: `platform/src/lib/orchestration/aks-adapter.ts:88-103` - runtime image precedence and failure message.
  - Pattern: `platform/.env.example:1-32` - env documentation format.
  - Pattern: `platform/README.md` - currently stale mock-only language.

  **Acceptance Criteria**:
  - [x] `platform/.env.example` documents all AKS env vars without secret values.
  - [x] `platform/README.md` says mock is default but AKS backend exists and lists required prod env.
  - [x] A missing-image check exists in tests or a direct unit assertion verifies the adapter throws `AKS create requires a runtime image`.
  - [x] `pnpm --dir platform typecheck` passes.

  **QA Scenarios**:
  ```
  Scenario: Missing runtime image fails clearly
    Tool: Bash
    Steps: Run the targeted AKS adapter test with `AKS_RUNTIME_IMAGE` and `ABRA_RUNTIME_IMAGE` unset.
    Expected: Test passes and confirms the error message contains `AKS create requires a runtime image`.
    Evidence: .sisyphus/evidence/task-1-runtime-contract.txt

  Scenario: Env docs contain AKS contract
    Tool: Bash
    Steps: Search `platform/.env.example` for `ORCHESTRATION_BACKEND`, `AKS_RUNTIME_IMAGE`, `AKS_RUNTIME_NAMESPACE`, `AKS_PVC_RETENTION_DAYS`.
    Expected: All four names are present exactly as server-read env vars, with empty/example values only.
    Evidence: .sisyphus/evidence/task-1-env-docs.txt
  ```

  **Commit**: YES | Message: `docs(platform): document aks runtime contract` | Files: `platform/.env.example`, `platform/README.md`, tests if needed

- [x] 2. Expose minimal Terraform outputs and AKS image-pull access

  **What to do**: Keep `prod` foundation-only. Add only missing outputs needed by deployment: ACR login server/name/id, Key Vault id/URI, Storage account/container names, Service Bus queue names, AKS cluster name/resource group/OIDC issuer. Add AKS-to-ACR pull access if absent using the cluster kubelet identity against the ACR scope. Keep old `modules/agent` and `modules/router` out of active prod scope.

  **Must NOT do**: Do not create broad new modules unless validation proves one minimal resource cannot be represented in `foundation`. Do not rewrite Container Apps modules.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Terraform output/access changes require care.
  - Skills: [`terraform-engineer`] - Terraform validation and Azure resource access patterns.
  - Omitted: `terraform-style-guide` - Existing style is simple enough.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4, 5 | Blocked By: none

  **References**:
  - Pattern: `terraform/environments/prod/main.tf:14-35` - prod currently only wires foundation.
  - Pattern: `terraform/modules/foundation/main.tf:26-34` - ACR resource.
  - Pattern: `terraform/modules/foundation/main.tf:155-205` - AKS cluster with workload identity/OIDC.
  - Pattern: `terraform/modules/foundation/outputs.tf:1-116` - current output style.
  - Pattern: `terraform/environments/prod/outputs.tf:1-39` - prod output passthrough style.

  **Acceptance Criteria**:
  - [x] `terraform/modules/foundation/outputs.tf` and `terraform/environments/prod/outputs.tf` expose deployment-needed ACR, AKS, Key Vault, Storage, and Service Bus values.
  - [x] Terraform includes AKS kubelet identity `AcrPull` role assignment for the foundation ACR.
  - [x] `terraform -chdir=terraform/environments/prod fmt -check -recursive` passes.
  - [x] `terraform -chdir=terraform/environments/prod validate` passes after `terraform init`.

  **QA Scenarios**:
  ```
  Scenario: Terraform validates after minimal output/access changes
    Tool: Bash
    Steps: Run `terraform -chdir=terraform/environments/prod init -backend-config=../../backend/prod.hcl`, then `terraform -chdir=terraform/environments/prod validate`.
    Expected: Both commands exit 0.
    Evidence: .sisyphus/evidence/task-2-terraform-validate.txt

  Scenario: Terraform plan includes no Container Apps resources
    Tool: Bash
    Steps: Run `terraform -chdir=terraform/environments/prod plan -var-file=prod.tfvars -out=tfplan`, then inspect plan summary for `azurerm_container_app`.
    Expected: Plan succeeds and contains no active `azurerm_container_app` resources.
    Evidence: .sisyphus/evidence/task-2-terraform-plan.txt
  ```

  **Commit**: YES | Message: `infra(aks): expose runtime outputs and acr pull access` | Files: `terraform/modules/foundation/*`, `terraform/environments/prod/*`

- [x] 3. Complete minimal Kubernetes runtime reconciliation

  **What to do**: Ensure the AKS adapter creates or verifies every Kubernetes object required by the generated runtime manifests. At minimum: namespace exists, service account exists when configured, PVC exists, Service exists, StatefulSet exists, and any ConfigMap/Secret referenced by the StatefulSet is either created by the adapter or removed from the generated manifest. Preserve current create/update/restart/destroy/status API shape.

  **Must NOT do**: Do not build a full operator/controller. Do not add autoscaling or ingress/gateway redesign in this phase.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Kubernetes API lifecycle work with tests.
  - Skills: [] - Current code uses direct Kubernetes client abstractions.
  - Omitted: `docker-patterns` - No Dockerfile changes in this task.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5 | Blocked By: none

  **References**:
  - Pattern: `platform/src/lib/orchestration/aks-adapter.ts:52-62` - current resource client interface.
  - Pattern: `platform/src/lib/orchestration/aks-adapter.ts:26-42` - create flow currently only orders storage/service/workload.
  - Pattern: `platform/src/lib/orchestration/aks-adapter.ts:106-115` - runtime handle and service route shape.

  **Acceptance Criteria**:
  - [x] Adapter tests prove create reconciles all referenced objects in deterministic order.
  - [x] Destroy path deletes only runtime-owned resources and preserves/handles PVC retention as currently configured.
  - [x] Missing namespace/service-account/config produces clear operation failure metadata, not an unhandled exception.
  - [x] `pnpm --dir platform test:unit` or targeted orchestration tests pass.

  **QA Scenarios**:
  ```
  Scenario: AKS create reconciles runtime objects
    Tool: Bash
    Steps: Run targeted unit tests for AKS create using fake Kubernetes client.
    Expected: Test verifies namespace/service-account/config if applicable, PVC, Service, and StatefulSet calls occur before readiness polling.
    Evidence: .sisyphus/evidence/task-3-aks-create-test.txt

  Scenario: AKS create failure is durable and inspectable
    Tool: Bash
    Steps: Run targeted unit test where fake Kubernetes client rejects one object creation.
    Expected: Operation is marked failed with error metadata and no unhandled rejection.
    Evidence: .sisyphus/evidence/task-3-aks-failure-test.txt
  ```

  **Commit**: YES | Message: `feat(platform): complete minimal aks runtime reconciliation` | Files: `platform/src/lib/orchestration/*`, orchestration tests

- [x] 4. Apply infrastructure, build runtime image, and configure Vercel prod env

  **What to do**: With authenticated `az` and Terraform, run the production Terraform flow. Build the Abra/OpenClaw runtime container image from the repo Dockerfile, push it to the Terraform-created ACR, then configure Vercel env for the deployed platform to use AKS. Required Vercel env values: `ORCHESTRATION_BACKEND=aks`, `AKS_RUNTIME_IMAGE=<acr-login-server>/<runtime-image>:<tag>`, `AKS_RUNTIME_NAMESPACE=<namespace>`, plus Azure auth/workload identity values required by `aks-k8s-bootstrap.ts`. Keep Firebase env untouched except verifying it still exists.

  **Must NOT do**: Do not commit `.env`, `prod.tfvars`, Terraform state, or image credentials. Do not switch production traffic if preview smoke test fails.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Real cloud deployment with Terraform, Azure CLI, Docker, and Vercel CLI.
  - Skills: [`terraform-engineer`] - Terraform apply safety.
  - Omitted: `github-actions-docs` - No CI workflow changes.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 5 | Blocked By: 1, 2

  **References**:
  - Pattern: `terraform/README.md` - bootstrap/prod deployment flow.
  - Pattern: `terraform/environments/prod/prod.tfvars.example:1-26` - required prod tfvars shape.
  - Pattern: `platform/src/lib/orchestration/server.ts:18-37` - Vercel env backend switch.
  - Pattern: `platform/src/lib/orchestration/aks-adapter.ts:88-103` - runtime image env fallback.

  **Acceptance Criteria**:
  - [x] `terraform apply tfplan` succeeds for `terraform/environments/prod`.
  - [x] `terraform output -json` includes required AKS/ACR/storage/key-vault outputs.
  - [x] Runtime image is pushed to ACR and visible via `az acr repository show-tags`.
  - [x] Vercel project env contains required AKS variables for the target environment.
  - [x] A new Vercel preview deployment builds successfully after env configuration.

  **QA Scenarios**:
  ```
  Scenario: Terraform and ACR deployment path succeeds
    Tool: Bash
    Steps: Run Terraform plan/apply, query outputs, build/push image, then list ACR tags.
    Expected: Terraform exits 0 and ACR lists the pushed image tag used in `AKS_RUNTIME_IMAGE`.
    Evidence: .sisyphus/evidence/task-4-azure-deploy.txt

  Scenario: Vercel has AKS env contract
    Tool: Bash
    Steps: Run `vercel env ls` for the platform project/scope and inspect required variable names only.
    Expected: Required AKS variable names are present; no secret values are printed into evidence.
    Evidence: .sisyphus/evidence/task-4-vercel-env.txt
  ```

  **Commit**: NO | Message: n/a | Files: cloud deployment only

- [x] 5. Run one end-to-end AKS smoke test and record rollback path

  **What to do**: Use the deployed Vercel preview or production target with `ORCHESTRATION_BACKEND=aks` to submit one minimal deployment request. Verify the operation record progresses through AKS create phases, Kubernetes resources exist in the target namespace, pod readiness is observed or failure is durable and clear, and the platform status endpoint reports the same final state. Record rollback commands: set Vercel `ORCHESTRATION_BACKEND=mock`, redeploy, and delete the test runtime resources if needed.

  **Must NOT do**: Do not declare migration complete if smoke test only validates Terraform. Do not leave test runtime resources running indefinitely.

  **Recommended Agent Profile**:
  - Category: `deep` - End-to-end cloud/platform verification across browser/API/Kubernetes.
  - Skills: [`playwright-cli`] - Browser/API smoke test if UI auth path is used.
  - Omitted: `review-work` - Final verification wave handles review separately.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Final Verification | Blocked By: 3, 4

  **References**:
  - Pattern: `platform/src/lib/orchestration/server.ts:46-61` - action dispatch into selected adapter.
  - Pattern: `platform/src/lib/orchestration/aks-adapter.ts:26-42` - expected create flow phases.
  - Pattern: `terraform/environments/prod/outputs.tf:11-29` - cluster and OIDC outputs for validation.

  **Acceptance Criteria**:
  - [x] One deployment request uses AKS backend, not mock backend.
  - [x] `kubectl get pvc,svc,statefulset,pod -n <namespace>` shows expected test runtime resources.
  - [x] Platform operation status endpoint returns `running`, `succeeded`, or a clear durable `failed` with AKS error metadata; no unhandled 500.
  - [x] Rollback evidence shows how to revert Vercel to mock and remove test resources.

  **QA Scenarios**:
  ```
  Scenario: AKS-backed deployment smoke path
    Tool: Playwright + Bash
    Steps: Sign in to platform, submit one minimal deployment request, poll operation/status endpoint, then run `kubectl get` for expected runtime resources.
    Expected: Request reaches AKS adapter and Kubernetes resources exist or operation fails durably with actionable AKS metadata.
    Evidence: .sisyphus/evidence/task-5-aks-smoke.md

  Scenario: Rollback path is executable
    Tool: Bash
    Steps: Run documented commands in dry-run/list mode where possible: list Vercel env backend value, list test runtime resources, and prepare deletion commands.
    Expected: Evidence contains exact rollback commands without secret values.
    Evidence: .sisyphus/evidence/task-5-rollback.txt
  ```

  **Commit**: YES | Message: `docs(aks): record smoke test and rollback runbook` | Files: deployment runbook/evidence references only

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: runtime env contract/docs/tests.
- Commit 2: Terraform outputs/access.
- Commit 3: minimal AKS runtime reconciliation.
- No commit for live Terraform apply or Vercel env changes.
- Commit 4: smoke-test runbook/docs only if repository docs are changed.

## Success Criteria
- The app remains deployable to Vercel.
- Terraform prod applies foundation resources successfully.
- Runtime image is available in ACR and referenced by Vercel env.
- One AKS-backed operation proves the platform can reach Kubernetes and reconcile runtime resources.
- If AKS fails, failure is durable, visible, and rollback to mock backend is documented.
