# Production Environment

This root module deploys the first production environment for Abra.

Status: module wiring is in place and the configuration validates locally.

## Included resources

- shared foundation module
- public router Container App
- one agent Container App per `users` entry

## Terraform-managed onboarding

Per-user agents are created by editing `users` in your tfvars and running:

```bash
terraform plan -var-file=prod.tfvars
terraform apply -var-file=prod.tfvars
```

This is Terraform-managed onboarding, not runtime self-provisioning.

## Validation flow

```bash
terraform fmt -recursive
terraform init -backend-config=../../backend/prod.hcl
terraform validate
terraform plan -var-file=prod.tfvars
```

## Important runtime note

This environment provisions Azure resources only. The application still must be adapted to consume:

- Blob-backed artifacts instead of local `input/`, `output/`, and `archive/`
- Key Vault / env-backed configuration instead of `~/.openclaw/openclaw.json`
- Blob-backed brand asset storage instead of local `skills/brand-manager/brand-assets/`

## Next steps

1. Fill `terraform/backend/prod.hcl` with real backend values.
2. Copy `prod.tfvars.example` to `prod.tfvars` and replace placeholders.
3. Run `terraform init`, `terraform plan`, and `terraform apply` against Azure.
