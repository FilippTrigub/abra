output "blob_container_names" {
  description = "Blob containers created for Abra runtime artifacts"
  value       = module.foundation.blob_container_names
}

output "key_vault_uri" {
  description = "Foundation Key Vault URI"
  value       = module.foundation.key_vault_uri
}

output "kubernetes_cluster_fqdn" {
  description = "Public FQDN of the AKS cluster"
  value       = module.foundation.kubernetes_cluster_fqdn
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

output "storage_account_name" {
  description = "Foundation storage account name"
  value       = module.foundation.storage_account_name
}
