output "container_app_id" {
  description = "Resource ID of the router Container App"
  value       = azurerm_container_app.router.id
}

output "default_hostname" {
  description = "Latest revision FQDN for the router Container App"
  value       = azurerm_container_app.router.latest_revision_fqdn
}
