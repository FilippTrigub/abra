output "resource_group_name" {
  description = "Name of the foundation resource group"
  value       = azurerm_resource_group.this.name
}

output "resource_group_location" {
  description = "Location of the foundation resource group"
  value       = azurerm_resource_group.this.location
}

output "container_registry_login_server" {
  description = "Fully qualified login server for the ACR"
  value       = azurerm_container_registry.this.login_server
}

output "container_registry_id" {
  description = "Resource ID of the ACR"
  value       = azurerm_container_registry.this.id
}

output "storage_account_name" {
  description = "Name of the app storage account"
  value       = azurerm_storage_account.app.name
}

output "storage_account_id" {
  description = "Resource ID of the app storage account"
  value       = azurerm_storage_account.app.id
}

output "service_bus_namespace" {
  description = "Fully qualified Service Bus namespace endpoint"
  value       = azurerm_servicebus_namespace.this.default_primary_connection_string
}

output "service_bus_namespace_id" {
  description = "Resource ID of the Service Bus namespace"
  value       = azurerm_servicebus_namespace.this.id
}

output "service_bus_job_dispatch_queue_name" {
  description = "Name of the job-dispatch queue"
  value       = azurerm_servicebus_queue.job_dispatch.name
}

output "service_bus_job_completion_queue_name" {
  description = "Name of the job-completion queue"
  value       = azurerm_servicebus_queue.job_completion.name
}

output "key_vault_id" {
  description = "Resource ID of the Key Vault"
  value       = azurerm_key_vault.this.id
}

output "key_vault_uri" {
  description = "URI of the Key Vault for secret access"
  value       = azurerm_key_vault.this.vault_uri
}

output "postgresql_flexible_server_id" {
  description = "Resource ID of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.this.id
}

output "postgresql_flexible_server_fqdn" {
  description = "Fully qualified domain name of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.this.fqdn
}

output "postgresql_database_name" {
  description = "Name of the platform PostgreSQL database"
  value       = azurerm_postgresql_flexible_server_database.platform.name
}

output "container_apps_environment_id" {
  description = "Resource ID of the Container Apps Environment"
  value       = azurerm_container_app_environment.this.id
}

output "log_analytics_workspace_id" {
  description = "Resource ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.id
}

output "blob_container_names" {
  description = "Names of blob containers created"
  value = {
    input          = azurerm_storage_container.input.name
    output         = azurerm_storage_container.output.name
    archive        = azurerm_storage_container.archive.name
    brand_assets   = azurerm_storage_container.brand_assets.name
    runpod_staging = azurerm_storage_container.runpod_staging.name
  }
}
