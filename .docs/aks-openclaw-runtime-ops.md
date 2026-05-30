# AKS OpenClaw Runtime — Operations Notes

Lessons from getting the first successful end-to-end deployment on 2026-05-30.

---

## How it works

### Deployment flow

1. User clicks **Deploy Abra** on the dashboard.
2. `submitDeploymentRequest` (Next.js server action) calls `createDeploymentRecord`, which writes a `queued` deployment doc to Firestore at `accounts/<uid>/deployments/abra-instance`.
3. `after()` calls `dispatchDeploymentRequest`, which creates an `OrchestrationOperation` in `orchestration_operations` collection and persists the `operationId` into the deployment doc.
4. The dashboard polls `GET /api/dashboard/deployments/abra-instance/status` at the interval stored in `pollAfterMs`.
5. Each poll calls `syncDeploymentStatusForUser` → `getStatus(operationId)` on the AKS adapter, which drives a state machine through phases:
   - `create_created` → creates namespace, ConfigMap, Secret, PVC
   - `storage_reconciled` → creates Service
   - `service_reconciled` → creates StatefulSet (pod starts)
   - `workload_reconciled` / `waiting_for_readiness` → polls pod readiness
   - `runtime_ready` → sets `status: succeeded`, writes `gatewayRoute` into operation result

### Kubernetes resources per runtime

| Resource | Name pattern | Purpose |
|----------|-------------|---------|
| Namespace | `abra` | shared across all runtimes |
| ConfigMap | `<account>-<deploy>-config` | seeds `openclaw.json` into the PVC via init container |
| Secret | `<account>-<deploy>-secrets` | seeds `env` file into the PVC (may be empty) |
| PVC | `<account>-<deploy>-data` | persists `~/.openclaw` across restarts |
| Service | `<account>-<deploy>-svc` | stable ClusterIP for gateway routing |
| StatefulSet / Pod | `<account>-<deploy>` | the OpenClaw runtime |

Resource names use compact identifiers (see `naming-helpers.ts`). The max safe Kubernetes name length is **63 characters** for Services and labels.

### Failure cleanup

On create-flow failure, `failOperation` deletes the StatefulSet, Service, ConfigMap, and Secret — but **retains the PVC** (configurable via `AKS_PVC_RETENTION_DAYS`). The next deployment reuses the same PVC if the names are persisted in `aksNames`.

---

## What to watch out for

### 1. Firestore rejects `undefined` fields

**Symptom:** `Update() requires a valid Firestore value. Cannot use "undefined" as a Firestore value (found in field requestPayload.orchestration.aksNames)` in Vercel `after()` logs.

**Cause:** `AkRuntimeMetadata` has optional fields (`serviceAccountName`, `configRevision`, `podName`, `gatewayRoute`). When spread into a Firestore `update()` call, any `undefined` field is rejected.

**Fix applied:** `admin.firestore().settings({ ignoreUndefinedProperties: true })` in `lib/firebase/admin.ts`. This silently strips undefined fields before writing.

**Avoid:** Passing TypeScript objects with optional fields directly to Firestore without first stripping undefineds, unless `ignoreUndefinedProperties` is set.

---

### 2. Init container image must have a shell

**Symptom:** `Runtime failed before readiness: Error` immediately after pod creation (pod phase stays `Running` for seconds then fails).

**Cause:** `bitnami/kubectl:latest` is a distroless-style image. It contains only the `kubectl` binary — no `/bin/sh`, no `mkdir`, no `chown`. The init container command `["/bin/sh", "-c", "..."]` fails immediately when the shell is not found.

**Fix applied:** Changed to `busybox:latest`, which has `/bin/sh` and all standard Unix utilities. The init container also runs as `runAsUser: 0` because it needs to `chown` the PVC directory.

**Avoid:** Using purpose-built tool images (bitnami/kubectl, distroless variants) as init containers for shell scripts. Use `busybox:latest` or `alpine:latest` instead.

---

### 3. OpenClaw requires a non-empty gateway config to start

**Symptom:** `Runtime failed before readiness: CrashLoopBackOff` — pod phase goes `Pending` → `Running` → crash, visible in CrashLoopBackOff within ~5 minutes.

**Cause:** The ConfigMap seeded `openclaw.json` with `{}` (empty object). OpenClaw checks for a valid `gateway.mode` on startup and exits with:
```
Missing config. Run `openclaw setup` or set gateway.mode=local (or pass --allow-unconfigured).
```

**Fix applied:** Changed the ConfigMap to seed `{"gateway":{"mode":"local"}}`. In local mode the gateway starts without needing an external service or auth token.

**Avoid:** Leaving `openclaw.json` as an empty object. At minimum it needs `{"gateway":{"mode":"local"}}` to allow the runtime to start. Any additional agent config (model keys, etc.) should be layered on top.

---

### 4. OpenClaw HTTP server binds to loopback — do not use httpGet probes

**Symptom:** `Runtime failed before readiness: CrashLoopBackOff` — container restarts every ~60 seconds (matching `initialDelaySeconds: 30` + `failureThreshold: 3` × `periodSeconds: 10`). Container logs show a healthy `[gateway] ready` on each restart.

**Cause:** OpenClaw binds its HTTP gateway to `127.0.0.1:18789` (loopback only). Kubernetes `httpGet` probes are sent by the **kubelet on the node** to the **pod IP** — a different network interface. The kubelet can never reach `127.0.0.1` inside the pod, so the liveness probe always fails and kills the container after 60 s.

Verified with:
```
kubectl exec -n abra <pod> -c openclaw -- curl -s http://localhost:18789/health
# → {"ok":true,"status":"live"}   ← works from inside
```
vs.
```
# httpGet probe from kubelet to pod IP:18789 → connection refused
```

**Fix applied:** Changed both `readinessProbe` and `livenessProbe` from `httpGet` to `exec`:
```yaml
exec:
  command: ["curl", "-sf", "http://localhost:18789/health"]
```
`exec` probes run inside the pod's network namespace, where `localhost` resolves correctly.

**Note on Service routing:** Because OpenClaw binds to loopback, the Kubernetes Service (`ClusterIP:18789`) cannot route to it either. Any gateway-to-runtime traffic will need `kubectl port-forward` or a sidecar proxy until OpenClaw is configured to bind on `0.0.0.0`. Track this separately.

**Avoid:** Using `httpGet` probes for any process that intentionally binds to loopback. Always use `exec` with an in-container curl/wget, or configure the process to listen on `0.0.0.0`.

---

## Debugging checklist

When a deployment fails, check in this order:

1. **Vercel logs** — `after()` errors surface there first (Firestore, dispatch failures).
2. **Firestore `orchestration_operations`** — `steps[]` array shows which phase failed and what the error message was.
3. **`kubectl get pods -n abra`** — check pod phase and restart count.
4. **`kubectl logs <pod> -c init-hydration`** — if pod stays `Pending`, init container is crashing.
5. **`kubectl logs <pod> -c openclaw`** — if pod phase is `Running` with restarts, main container is crashing; logs show why.
6. **`kubectl describe pod <pod> -n abra`** — probe failure details, image pull errors, scheduling issues.

## Running the E2E deployment test

```bash
cd platform
pnpm playwright test --config=playwright.deployment.config.ts
```

Targets `https://abra-platform.vercel.app` (production). Requires Firebase Admin credentials in `.env.local`. Times out after 12 minutes of polling. Asserts `status === "succeeded"` and a valid `resultUrl`.

Set `E2E_BASE_URL=<url>` to target a different environment.
