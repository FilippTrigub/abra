output "blob_container_names" {
  description = "Blob containers created for Abra runtime artifacts"
  value       = module.foundation.blob_container_names
}

output "container_registry_id" {
  description = "Resource ID of the foundation ACR"
  value       = module.foundation.container_registry_id
}

output "container_registry_name" {
  description = "Name of the foundation ACR"
  value       = module.foundation.container_registry_name
}

output "container_registry_login_server" {
  description = "Login server of the foundation ACR"
  value       = module.foundation.container_registry_login_server
}

output "key_vault_id" {
  description = "Foundation Key Vault resource ID"
  value       = module.foundation.key_vault_id
}

output "key_vault_name" {
  description = "Foundation Key Vault name"
  value       = module.foundation.key_vault_name
}

output "key_vault_uri" {
  description = "Foundation Key Vault URI"
  value       = module.foundation.key_vault_uri
}

output "kubernetes_cluster_fqdn" {
  description = "Public FQDN of the AKS cluster"
  value       = module.foundation.kubernetes_cluster_fqdn
}

output "kubernetes_cluster_id" {
  description = "Resource ID of the AKS cluster"
  value       = module.foundation.kubernetes_cluster_id
}

output "kubernetes_cluster_name" {
  description = "Name of the AKS cluster"
  value       = module.foundation.kubernetes_cluster_name
}

output "kubernetes_cluster_node_resource_group" {
  description = "Azure-managed node resource group for the AKS cluster"
  value       = module.foundation.kubernetes_cluster_node_resource_group
}

output "kubernetes_oidc_issuer_url" {
  description = "OIDC issuer URL for AKS workload identity"
  value       = module.foundation.kubernetes_oidc_issuer_url
}

output "resource_group_name" {
  description = "Name of the production resource group"
  value       = module.foundation.resource_group_name
}

output "service_bus_job_completion_queue_name" {
  description = "Service Bus queue name for job completion events"
  value       = module.foundation.service_bus_job_completion_queue_name
}

output "service_bus_job_dispatch_queue_name" {
  description = "Service Bus queue name for job dispatch events"
  value       = module.foundation.service_bus_job_dispatch_queue_name
}

output "service_bus_namespace" {
  description = "Primary connection string for the foundation Service Bus namespace"
  value       = module.foundation.service_bus_namespace
  sensitive   = true
}

output "service_bus_namespace_id" {
  description = "Resource ID of the foundation Service Bus namespace"
  value       = module.foundation.service_bus_namespace_id
}

output "service_bus_namespace_name" {
  description = "Name of the foundation Service Bus namespace"
  value       = module.foundation.service_bus_namespace_name
}

output "storage_account_id" {
  description = "Foundation storage account resource ID"
  value       = module.foundation.storage_account_id
}

output "storage_account_name" {
  description = "Foundation storage account name"
  value       = module.foundation.storage_account_name
}
