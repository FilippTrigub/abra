# Task 5 AKS smoke evidence — 2026-06-10

## Hosted production target

- Vercel production alias: `https://abra-platform.vercel.app`
- Production deployment verified ready: `https://abra-platform-ov7cd0itt-trigub-tech.vercel.app`
- Auth method: one-hour Firebase session cookie minted via Firebase Admin for the existing platform account; no credentials or token values recorded.

## Production orchestration smoke request

- API route: `POST /api/orchestration/operations`
- Adapter: `aks`
- Deployment id: `smoke-hermes-20260609233738`
- Request id: `2d40bb4e-0a34-4c87-92fb-ac8446d734ef`
- Operation id: `907defeb-917f-435b-a9e5-86674fe4e10c`
- Runtime image: `abraacr914f.azurecr.io/abra:hermes-202606092229-3277038`
- Resource handle: `aks-runtime/abra/abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-her-6dec2a74`

Final operation status from authenticated production polling:

```json
{
  "deploymentId": "smoke-hermes-20260609233738",
  "operationId": "907defeb-917f-435b-a9e5-86674fe4e10c",
  "finalStatus": "succeeded",
  "adapter": "aks",
  "resourceHandle": "aks-runtime/abra/abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-her-6dec2a74",
  "statefulSetName": "abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-her-6dec2a74",
  "hasAgentConfigInPayload": false,
  "agentConfigRef": "account-current"
}
```

Recorded operation steps:

```text
queued    AKS create request persisted. Storage reconciliation will start on the next poll.
running   Runtime namespace, configuration, and persistent storage reconciled.
running   Runtime service reconciled and ready for workload binding.
running   Runtime workload reconciled. Waiting for hydration and readiness.
running   Waiting for hydrated runtime readiness (pod phase: Pending).
succeeded Runtime readiness confirmed through StatefulSet and pod conditions.
```

## AKS resource inventory before cleanup

Captured with:

```bash
az aks command invoke \
  --resource-group abra-rg-foundation \
  --name abra-aks \
  --command "kubectl get pvc,svc,statefulset,pod,configmap,secret -n abra -l abra.io/deployment-id=smoke-hermes-20260609233738 -o wide"
```

Result:

```text
persistentvolumeclaim/abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-her-6dec2a74-data   Bound   pvc-7a69bb11-94bd-479c-bccd-3b9c7e86dfb6   1Gi   RWO   default
service/abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-her-6dec2a74-svc                  ClusterIP   10.0.116.157   <none>   18789/TCP
statefulset.apps/abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-her-6dec2a74              1/1   openclaw   abraacr914f.azurecr.io/abra:hermes-202606092229-3277038
pod/abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-her-6dec2a74-0                         1/1   Running   0   10.224.0.9
configmap/abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-her-6dec2a74-config              DATA=1
secret/abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-her-6dec2a74-secrets                Opaque   DATA=4
```

The smoke Service and StatefulSet selectors were account-scoped after the F2 hardening fix:

```text
Service selector={"abra.io/account-id":"FJYQATlMASRVEFkF0g6lGaJZ9gv2","abra.io/deployment-id":"smoke-hermes-20260609233738","app":"abra"}
StatefulSet selector={"matchLabels":{"abra.io/account-id":"FJYQATlMASRVEFkF0g6lGaJZ9gv2","abra.io/deployment-id":"smoke-hermes-20260609233738","app":"abra"}}
```

Secret key validation, without values:

```text
TELEGRAM_ALLOWED_USERS:  9 bytes
TELEGRAM_BOT_TOKEN:      46 bytes
TELEGRAM_HOME_CHANNEL:   9 bytes
env:                     130 bytes
```

## Bug found and fixed during smoke

The first smoke attempt reached AKS but the StatefulSet controller could not create a pod:

```text
metadata.labels: Invalid value: "abra-fjyqatlmasrvefkf0g6lgajz9gv2-smoke-hermes-56b32d58-6c6cbf7f85": must be no more than 63 characters
```

Root cause: the StatefulSet name was within its object-name limit, but Kubernetes appends a `-{10-char-hash}` suffix for the `controller-revision-hash` label value. The naming helper now budgets for that suffix. The fix was committed as `69dfb25 Fix AKS smoke names`, pushed, and verified in production before the successful smoke above.

A later final-review hardening pass found two additional production blockers before completion:

- selectors needed account scoping to avoid tenant collisions in the shared `abra` namespace
- operation payloads must not persist raw `telegramBotToken`

Both were fixed, committed, pushed, deployed, and verified by the final smoke above. The final operation payload had `agentConfigRef: "account-current"` and no `agentConfig` object.

## Cleanup

The temporary smoke resources were deleted after evidence capture. Persistent production runtime `abra-fjyqatlmasrvefkf0g6lgajz9gv2-abra-instance` was not touched.

Post-cleanup inventory for the smoke label returned:

```text
No resources found in abra namespace.
```
