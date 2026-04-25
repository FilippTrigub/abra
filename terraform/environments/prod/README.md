# Production Environment

This root module deploys the first production **AKS foundation** for Abra.

Status: module wiring now provisions shared services plus an AKS cluster for future stateful OpenClaw runtimes.

## Included resources

- shared foundation module
- AKS cluster
- ACR
- Blob Storage containers
- Service Bus namespace and queues
- Key Vault
- PostgreSQL flexible server
- Log Analytics workspace

## Important scope note

This environment provisions **infrastructure only**.

It does **not** create per-user Abra StatefulSets, Services, or PVCs yet. Those runtime resources are expected to be created by the future orchestration backend so that the platform can manage create/update/restart/destroy flows dynamically.

## Validation flow

```bash
terraform fmt -recursive
terraform init -backend-config=../../backend/prod.hcl
terraform validate
terraform plan -var-file=prod.tfvars
```

## Important runtime note

This environment gives the platform the Azure foundation required by the AKS deployment plan. The application still must be adapted to:

- create and reconcile per-agent StatefulSets and PVCs in AKS
- hydrate `~/.openclaw` before OpenClaw startup
- map runtime artifacts to Blob Storage
- map secrets/config to Key Vault-backed runtime injection
- replace the mock deployment adapter with a real AKS orchestration adapter

## Next steps

1. Fill `terraform/backend/prod.hcl` with real backend values.
2. Copy `prod.tfvars.example` to `prod.tfvars` and replace placeholders.
3. Run `terraform init`, `terraform plan`, and `terraform apply` against Azure.
