# Shared Foundation Module

Creates the shared Azure resources for the Abra platform:

- Resource Group
- Azure Container Registry
- App Storage Account + Blob Containers
- Service Bus Namespace + Queues/Topics
- Key Vault
- Azure Database for PostgreSQL Flexible Server
- Container Apps Environment
- Log Analytics Workspace

## Variable: PostgreSQL

Azure Database for PostgreSQL Flexible Server is the **recommended default**
metadata store. The control plane needs structured metadata for users,
agents, jobs, and artifact references. If you later decide a simpler
key/value store suffices, this module can be simplified.

## Resource Naming

All resources use the `naming_prefix` variable, suffixed with a random
4-character hex string to ensure uniqueness when the same module is
deployed multiple times in the same region.
