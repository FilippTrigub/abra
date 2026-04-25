# Shared Foundation Module

Creates the shared Azure resources for the Abra platform and the AKS runtime foundation:

- Resource Group
- Azure Kubernetes Service (AKS)
- Azure Container Registry
- App Storage Account + Blob Containers
- Service Bus Namespace + Queues
- Key Vault
- Azure Database for PostgreSQL Flexible Server
- Log Analytics Workspace

## Scope

This module provisions the Azure foundation that the platform and future orchestration backend depend on.

It does **not** create the per-agent Kubernetes workloads themselves. Those runtime resources should be created dynamically by the orchestration layer so the platform can control deployment lifecycle and status transitions.

## Variable: PostgreSQL

Azure Database for PostgreSQL Flexible Server is the recommended default metadata store for control-plane data such as users, agents, deployments, runtime revisions, and artifact references.

## Variable: AKS

The AKS cluster created here is the target runtime platform for stateful OpenClaw-based Abra agents. The cluster is configured with:

- system-assigned identity
- workload identity enabled
- OIDC issuer enabled
- Azure Key Vault Secrets Provider addon
- Azure CNI networking

## Resource Naming

All resources use the `naming_prefix` variable, suffixed with a random 4-character hex string where global uniqueness is required.
