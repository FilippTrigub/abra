output "storage_account_name" {
  description = "Name of the Terraform state storage account"
  value       = azurerm_storage_account.this.name
}

output "state_container_name" {
  description = "Name of the Terraform state container"
  value       = azurerm_storage_container.state.name
}
