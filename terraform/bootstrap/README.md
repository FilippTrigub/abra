# Bootstrap — Terraform Remote State Backend

Creates the Azure Storage Account and container used for Terraform remote state.

## Why Separate

Terraform cannot reference a backend that does not exist yet. The bootstrap stack creates
the storage account and container so the main environment can point its `backend "azurerm"`
block at a real resource.

## Usage

```bash
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

Outputs from this module are used in `environments/prod/providers.tf` indirectly via the
backend configuration in `backend/prod.hcl`.

## Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `location` | `string` | `"northeurope"` | Azure region for the storage account |
| `naming_prefix` | `string` | `"abra"` | Short prefix used in resource names |
| `tags` | `map(string)` | `{}` | Common tags for all resources |

## Outputs

| Output | Description |
|---|---|
| `storage_account_name` | Name of the created storage account |
| `state_container_name` | Name of the state container |

## Notes

- Uses a single shared storage account — acceptable because state access is governed by
  SAS tokens, not container ACLs.
- No tags or soft-delete configured here to keep the bootstrap minimal. Add soft-delete
  in Phase 6 hardening.
