# Azure Terraform Deployment for Abra

This repo contains Terraform infrastructure-as-code for deploying the **Azure foundation** for Abra.

Status: the Terraform layout now targets an **AKS-backed runtime architecture** rather than Azure Container Apps.

## Architecture

The infrastructure is split into three concerns:

1. **Bootstrap** — creates the Terraform remote state backend (storage account + container)
2. **Shared foundation** — Azure Container Registry, Blob Storage, Service Bus, Key Vault, PostgreSQL, Log Analytics
3. **Runtime platform** — AKS cluster for OpenClaw-based Abra runtimes

### Module Structure

```text
terraform/
├── README.md
├── bootstrap/              # Phase 1: remote state backend
├── backend/                # Remote state configuration per environment
├── modules/
│   └── foundation/         # Shared Azure services + AKS cluster
└── environments/
    └── prod/               # Production foundation deployment
```

## What Terraform Provisions

Terraform now provisions the **platform foundation**, not individual Abra runtimes.

It creates:

- an AKS cluster
- Azure Container Registry
- Blob Storage containers for input/output/archive/brand assets
- Service Bus queues for orchestration
- Key Vault for secrets
- PostgreSQL for control-plane metadata
- Log Analytics for observability

The actual per-agent Kubernetes workloads described in `.docs/aks-abra-agent-deployment-plan.md` are expected to be managed by the future orchestration backend, not statically declared here.

## Runtime State Mapping

This infrastructure provisions Azure resources. The application code must still adapt OpenClaw/Abra runtime state to consume them:

| Repo concept | Azure resource |
|---|---|
| `~/.openclaw/` runtime home | per-agent PVC managed by orchestration backend |
| `skills/brand-manager/brand-assets/` | Blob container (`brand-assets`) |
| `input/staging/` | Blob container (`input/{user}`) |
| `output/` | Blob container (`output/{user}`) |
| `archive/` | Blob container (`archive/{user}`) |
| deployment metadata | PostgreSQL + Service Bus + platform persistence |
| secrets / sensitive config | Key Vault |

## Prerequisites

- Terraform >= 1.6
- Azure CLI authenticated (`az login`)
- A subscription with permissions to create Azure resources

## Quick Start

```bash
cd terraform

# Step 1: Bootstrap the remote state backend (one-time)
cd bootstrap
terraform init
terraform plan -out=tfplan
terraform apply tfplan
cd ..

# Step 2: Deploy the production foundation environment
cd environments/prod
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

## Provider Version Pinning

Providers are pinned in `environments/prod/providers.tf`.

## Next Steps

See [`NEXT_STEPS.md`](./NEXT_STEPS.md) for the rollout checklist.
