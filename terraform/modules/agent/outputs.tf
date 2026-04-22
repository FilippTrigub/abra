output "container_app_id" {
  description = "Resource ID of the agent Container App"
  value       = azurerm_container_app.agent.id
}

output "container_app_name" {
  description = "Name of the agent Container App"
  value       = azurerm_container_app.agent.name
}

output "container_app_default_hostname" {
  description = "Latest revision FQDN of the agent Container App"
  value       = azurerm_container_app.agent.latest_revision_fqdn
}

output "identity_id" {
  description = "Managed identity resource ID for the agent"
  value       = azurerm_user_assigned_identity.agent.id
}

output "secret_names" {
  description = "Names of Key Vault secrets created for this agent"
  value = {
    runpod_api_key = azurerm_key_vault_secret.runpod_api_key.name
    b2_bucket_name = azurerm_key_vault_secret.b2_bucket_name.name
    b2_key_id      = azurerm_key_vault_secret.b2_key_id.name
    b2_app_key     = azurerm_key_vault_secret.b2_app_key.name
  }
}
