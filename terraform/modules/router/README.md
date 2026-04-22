# Router Module

Creates the public HTTP control-plane Container App for Abra.

## What the Router Does

This is not just ingress. The router is a thin HTTP control plane that:

- receives platform requests
- resolves the target user agent
- forwards or enqueues work for that user
- reads/writes job metadata

## Container Image

The image reference is provided via `router_image`. It should be a small
HTTP service (e.g., FastAPI) that implements the control-plane contract.

## Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `environment_id` | `string` | (required) | Container Apps Environment resource ID |
| `router_image` | `string` | (required) | ACR image reference |
| `acr_login_server` | `string` | (required) | ACR login server for auth |
| `key_vault_id` | `string` | (required) | Key Vault resource ID |
| `tags` | `map(string)` | `{}` | Common tags |

## Outputs

| Output | Description |
|---|---|
| `container_app_id` | Resource ID of the router Container App |
| `default_hostname` | Public hostname of the router |
