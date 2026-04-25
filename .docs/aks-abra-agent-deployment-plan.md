# AKS Abra Agent Deployment Plan

## Goal

Define what an Abra deployment means when Abra is implemented as an **OpenClaw instance** running on **AKS**, and refine the runtime model so it matches the platform's existing deployment contract:

- durable deployment record first
- asynchronous orchestration
- status polling during lifecycle transitions
- explicit terminal/ready states

This note assumes the platform app remains the control plane and AKS becomes the real runtime backend.

## Core Runtime Definition

An **Abra agent** is a dedicated OpenClaw runtime for one user.

In operational terms, a deployed Abra agent is:

1. a Kubernetes workload running one OpenClaw container for one user
2. a persisted `~/.openclaw` home directory attached to that runtime
3. a private runtime that can keep running while the agent performs long autonomous work
4. a chat-capable runtime reachable through the OpenClaw gateway
5. a managed runtime whose desired config is owned by the platform

The deployment is not complete when the pod object exists. It is complete only when:

- the persistent `~/.openclaw` directory is mounted
- the expected config has been written into that directory
- the OpenClaw process has started successfully
- the runtime is reachable through the expected network path
- the platform can observe the runtime as `ready`

## Non-Negotiable Constraints

The design must preserve these constraints:

1. **`~/.openclaw` is persistent**
   - The directory is part of the runtime identity and must survive pod restarts.

2. **`~/.openclaw` must exist before OpenClaw starts**
   - Hydration/injection is a startup prerequisite, not a later side effect.

3. **Long-running work must not be interrupted by traffic inactivity**
   - A user may ask Abra to perform a task and then send no additional requests for ~20 minutes.
   - The runtime must remain alive for the duration of that work.

4. **The runtime must be reachable through the OpenClaw gateway**
   - The user must be able to chat with the deployed Abra agent.

5. **The platform must be able to update runtime configuration**
   - Config changes must flow from the platform into the deployed runtime in a controlled way.

## Important Clarification About "Pods Killed Due To Inactivity"

Plain AKS does **not** kill pods just because HTTP traffic stops.

If a previous Azure deployment stopped an agent after inactivity, that behavior almost certainly came from one of these layers rather than Kubernetes itself:

- request-driven autoscaling
- scale-to-zero runtime products
- ingress/controller idle behavior
- job-style execution instead of service-style execution
- cluster or node scale-down acting on evicted/rescheduled workloads

The consequence for this design is clear:

> **Abra agent pods must not use request-driven scale-to-zero semantics.**

For active deployments, the agent runtime should be treated as a normal long-lived workload with its own replica kept alive intentionally.

## Recommended AKS Runtime Shape

### Recommendation

Use **one StatefulSet per deployed Abra agent**, with:

- `replicas = 1`
- one PersistentVolumeClaim per agent
- one stable service identity per agent
- one OpenClaw container as the main runtime
- one init container responsible for hydrating `~/.openclaw` before startup

### Why StatefulSet Instead Of A Plain Deployment

StatefulSet is the better default because this runtime has identity and persistent state:

- stable pod/network identity is useful for gateway routing and debugging
- stable PVC binding matches the persistent `~/.openclaw` requirement
- rollout and restart behavior is easier to reason about when the runtime is effectively user-owned stateful infrastructure

A plain Deployment could work, but StatefulSet matches the semantics more directly.

## Persistence Model

### What Must Be Persisted

The persisted runtime state is the agent's `~/.openclaw` directory.

That directory should contain the files OpenClaw requires to boot and continue its work, including:

- `openclaw.json`
- any local agent memory/state files OpenClaw relies on
- any runtime-local settings that must survive restarts

### Recommended Storage Split

The persisted home directory should exist on a PVC, but the PVC should **not** become the only source of truth for all configuration.

Use this split:

- **PVC (`~/.openclaw`)**
  - runtime-local OpenClaw state
  - memory files
  - local config files required at boot
  - any state OpenClaw expects on disk

- **Platform database / deployment record**
  - desired deployment config revision
  - deployment lifecycle state
  - agent identity, ownership, environment, source ref
  - orchestration operation history

- **Key Vault / secret store**
  - sensitive credentials and secret material

- **Blob/object storage**
  - larger artifacts, uploads, generated outputs, archives

This keeps the runtime fast and compatible with OpenClaw's on-disk expectations without pushing every category of state into the PVC.

## Config Injection Before Startup

This is the most important startup rule:

> **The OpenClaw container must not start until the expected `~/.openclaw` contents are present.**

### Recommended Mechanism

Use an **init container** plus a **config revision contract**.

Flow:

1. The platform persists the desired deployment config and increments a config revision.
2. The orchestrator creates or updates the StatefulSet.
3. The pod starts.
4. The init container mounts the same PVC as the main container.
5. The init container writes or reconciles the expected `~/.openclaw` structure onto the PVC.
6. Only after that succeeds does the main OpenClaw container start.

The init container may pull source data from:

- platform-managed config payloads
- Key Vault-injected secrets
- Kubernetes Secret/ConfigMap material generated by the orchestrator

### Why This Is Better Than Post-Start Mutation

If configuration is injected after the main container starts, boot behavior becomes nondeterministic. OpenClaw may read partial state, race against file writes, or start with stale config.

Pre-start hydration makes readiness meaningful.

## Runtime Lifecycle

### Create

`create` means:

1. create durable deployment record in platform storage
2. provision PVC if the agent does not already have one
3. create or update StatefulSet and Service
4. wait for init-container hydration success
5. wait for pod readiness
6. register reachable runtime handle in deployment status

### Update

`update` means:

1. persist new desired config revision
2. trigger controlled pod restart or rolling reconciliation
3. re-run init hydration against the PVC
4. wait for the runtime to become ready again

The platform should not treat config updates as ad hoc file mutations over the network. They should be reconciled through the orchestration flow so that status remains observable and durable.

### Restart

`restart` means:

1. restart the StatefulSet pod
2. reuse the same PVC
3. re-run init hydration if needed
4. wait for readiness

### Destroy

`destroy` needs an explicit retention policy for the PVC.

Recommended default:

- destroying a deployment removes runtime compute resources
- the PVC is retained until explicitly deleted or garbage-collected by policy

This prevents accidental loss of `~/.openclaw` state.

## Readiness And Status Contract

The platform's current deployment model already expects:

- durable deployment records
- async dispatch
- polled status sync
- operation IDs

The AKS backend should keep that contract and map real runtime phases into orchestration steps.

Recommended step model:

1. `queued`
2. `provisioning_storage`
3. `creating_runtime`
4. `hydrating_openclaw_home`
5. `starting_openclaw`
6. `registering_gateway_route`
7. `ready`

Failure states should preserve step-level detail so the dashboard can tell the user whether failure came from:

- storage provisioning
- config hydration
- pod scheduling
- image pull
- readiness probe failure
- gateway registration

## Keeping The Pod Alive During Long Autonomous Work

This is a workload rule, not an ingress rule.

The agent pod must stay alive while it is actively working even if:

- the user sends no additional chat messages
- the gateway sees no new inbound traffic
- the platform is only polling deployment status occasionally

### Required Operational Consequences

1. **No scale-to-zero for active agent runtimes**
   - Do not use request-driven autoscaling for the agent pod.

2. **Replicas stay at 1 while the deployment is active**
   - The pod remains a normal service workload, not an ephemeral request worker.

3. **Readiness/liveness probes must match long-running work**
   - Probes should verify process health, not request volume.
   - They must not assume frequent traffic.

4. **Idle timeout, if any, must be explicit product policy**
   - If you later want cost-saving shutdowns, they should be driven by an intentional inactivity controller, not by traffic absence alone.

### Recommended Default Policy

Refined default:

- a deployment may cold-start before the first active session
- once a user opens a session or starts a task, the pod remains alive for the duration of that active work
- optional future policy: keep selected agents always warm

That satisfies the 20-minute no-traffic work window without forcing every deployment to be permanently warm forever.

## Networking Model

The runtime needs two networking relationships.

### 1. Connectivity To OpenClaw Gateway

The user-facing chat path should go through the OpenClaw gateway, not directly to the pod IP.

Recommended model:

- each agent gets a stable internal Service in AKS
- the gateway routes to the correct agent Service based on deployment/agent identity
- the agent is not exposed publicly as an arbitrary internet endpoint

This keeps routing explicit and avoids coupling users to ephemeral pod IPs.

### 2. Connectivity To Platform

The platform must be able to modify agent configuration, but that should be interpreted carefully.

Recommended rule:

> **The platform owns desired config. The orchestrator applies it.**

That means platform-to-agent communication should support:

- status and health checks
- controlled admin/reconcile calls if needed
- config change orchestration

But the preferred path for config changes is still:

1. write desired state in platform storage
2. trigger orchestration action
3. reconcile `~/.openclaw` through init/restart flow

Avoid building the system around direct live file editing over the network as the primary mechanism.

## Security / Multi-Tenancy Rules

Each Abra runtime is user-owned. The orchestration layer must preserve that isolation.

Minimum requirements:

- one workload per user deployment
- one PVC per user deployment
- no shared `~/.openclaw` volumes across users
- per-agent secrets scoped to the owning user/deployment
- gateway and platform calls authenticated and authorized per agent identity

## Implications For Terraform And Platform Code

### Terraform must eventually manage

- AKS cluster and node pools
- storage class / PVC strategy for agent home directories
- namespace and service layout
- internal networking for gateway ↔ agent and platform ↔ agent flows
- secret delivery path for agent startup hydration

### Platform code must eventually add

- a real orchestration adapter instead of the mock adapter
- a deployment status mapper for AKS lifecycle phases
- a notion of config revision and runtime readiness
- create/update/restart/destroy actions against AKS resources

The current platform deployment model is already suitable as the control-plane shell. What changes is the backend adapter and the runtime status semantics.

## Recommended Final Position

Use AKS, but treat Abra as a **stateful OpenClaw runtime**, not as a request-scaled HTTP worker.

The correct deployment shape is:

- **platform app** = control plane
- **AKS StatefulSet per agent** = runtime
- **PVC-backed `~/.openclaw`** = persistent runtime home
- **init container hydration before boot** = deterministic startup
- **gateway/service routing** = user chat path
- **explicit non-scale-to-zero behavior while active** = no interruption during long autonomous work

This is the refined architecture that best matches the constraints you defined.
