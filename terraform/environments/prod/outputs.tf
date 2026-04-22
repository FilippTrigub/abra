output "resource_group_name" {
  description = "Name of the production resource group"
  value       = module.foundation.resource_group_name
}

output "router_container_app_id" {
  description = "Resource ID of the public router Container App"
  value       = module.router.container_app_id
}

output "router_default_hostname" {
  description = "Public hostname of the router Container App"
  value       = module.router.default_hostname
}

output "agent_container_app_names" {
  description = "Names of all per-user agent Container Apps"
  value       = { for k, v in module.agents : k => v.container_app_name }
}

output "storage_account_name" {
  description = "Foundation storage account name"
  value       = module.foundation.storage_account_name
}

output "key_vault_uri" {
  description = "Foundation Key Vault URI"
  value       = module.foundation.key_vault_uri
}
