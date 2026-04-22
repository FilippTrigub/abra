# Agent Module

Creates one user-owned agent as an Azure Container App.

## Scaling

Each agent scales from **0 to 1** replicas. This is the core constraint
for the per-user architecture:

- `min_replicas = 0` — agent sleeps when idle, saving cost
- `max_replicas = 1` — single replica per user, no contention

When a request arrives, the agent warms up, processes the request,
then scales back to zero after the idle timeout.

## RunPod Integration

Each agent needs references to:

- `RUNPOD_API_KEY` — RunPod authentication
- Per-skill endpoint IDs (e.g. `RUNPOD_ENDPOINT_ID_VIDEO_EDITOR`)
- Backblaze B2 staging credentials (if using RunPod file transfer):
  - `BACKBLAZE_B2_RUNPOD_KEY_ID`
  - `BACKBLAZE_B2_RUNPOD_APPLICATION_KEY`
  - `BACKBLAZE_B2_RUNPOD_BUCKET_NAME`

These are stored as Key Vault secrets and injected into the Container App
as environment variable references.

## Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `environment_id` | `string` | (required) | Container Apps Environment resource ID |
| `agent_image` | `string` | (required) | ACR image reference for the agent |
| `user_id` | `string` | (required) | Unique user identifier |
| `blob_prefix` | `string` | (required) | Blob container prefix for user files |
| `key_vault_id` | `string` | (required) | Key Vault resource ID for secret refs |
| `key_vault_uri` | `string` | (required) | Key Vault URI |
| `acr_login_server` | `string` | (required) | ACR login server |
| `acr_admin_username` | `string` | (required) | ACR admin username |
| `acr_admin_password` | `string` | (required) | ACR admin password |
| `tags` | `map(string)` | `{}` | Common tags |

## Outputs

| Output | Description |
|---|---|
| `container_app_id` | Resource ID of the agent Container App |
| `container_app_name` | Name of the agent Container App |
| `identity_id` | Managed identity resource ID for the agent |
