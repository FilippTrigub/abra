# Next Steps

1. Add real values to `terraform/backend/prod.hcl`.
2. Copy `terraform/environments/prod/prod.tfvars.example` to `prod.tfvars`.
3. Replace placeholder PostgreSQL credentials and AKS access ranges.
4. Run `terraform init` in `terraform/environments/prod`.
5. Run `terraform plan -var-file=prod.tfvars`.
6. Run `terraform apply -var-file=prod.tfvars`.
7. Build the real orchestration backend that creates per-agent StatefulSets, Services, PVCs, and init-container hydration flows inside AKS.
8. Update the platform runtime to replace the mock orchestration adapter with the AKS-backed implementation.
