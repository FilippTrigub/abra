locals {
  random_suffix = substr(random_id.hex.hex, 0, 4)
}

resource "azurerm_resource_group" "this" {
  name     = "${var.naming_prefix}-rg-foundation"
  location = var.location

  tags = var.tags
}

resource "random_id" "hex" {
  byte_length = 2
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "${var.naming_prefix}-log"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = var.tags
}

resource "azurerm_container_registry" "this" {
  name                = "${var.naming_prefix}acr${local.random_suffix}"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "Standard"
  admin_enabled       = false

  tags = var.tags
}

resource "azurerm_storage_account" "app" {
  name                     = "${var.naming_prefix}stapp${local.random_suffix}"
  resource_group_name      = azurerm_resource_group.this.name
  location                 = azurerm_resource_group.this.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
  account_kind             = "StorageV2"

  https_traffic_only_enabled = true

  min_tls_version = "TLS1_2"

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
  }

  tags = var.tags
}

resource "azurerm_storage_container" "input" {
  name                  = "input"
  storage_account_name  = azurerm_storage_account.app.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "output" {
  name                  = "output"
  storage_account_name  = azurerm_storage_account.app.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "archive" {
  name                  = "archive"
  storage_account_name  = azurerm_storage_account.app.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "brand_assets" {
  name                  = "brand-assets"
  storage_account_name  = azurerm_storage_account.app.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "runpod_staging" {
  name                  = "runpod-staging"
  storage_account_name  = azurerm_storage_account.app.name
  container_access_type = "private"
}

resource "azurerm_servicebus_namespace" "this" {
  name                = "${var.naming_prefix}-sbns"
  resource_group_name = azurerm_resource_group.this.name
  location            = azurerm_resource_group.this.location
  sku                 = "Standard"

  tags = var.tags
}

resource "azurerm_servicebus_queue" "job_dispatch" {
  name               = "job-dispatch"
  namespace_id       = azurerm_servicebus_namespace.this.id
  max_delivery_count = 10
}

resource "azurerm_servicebus_queue" "job_completion" {
  name               = "job-completion"
  namespace_id       = azurerm_servicebus_namespace.this.id
  max_delivery_count = 10
}

resource "azurerm_key_vault" "this" {
  name                        = "${var.naming_prefix}-kv"
  resource_group_name         = azurerm_resource_group.this.name
  location                    = azurerm_resource_group.this.location
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  soft_delete_retention_days  = 90
  purge_protection_enabled    = false
  enabled_for_disk_encryption = false

  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
  }

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server" "this" {
  name                   = "${var.naming_prefix}-psql"
  resource_group_name    = azurerm_resource_group.this.name
  location               = azurerm_resource_group.this.location
  version                = "16"
  sku_name               = "B_Standard_B1ms"
  administrator_login    = var.postgres_admin_user
  administrator_password = var.postgres_admin_password
  zone                   = "1"
  storage_mb             = 32768

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server_database" "platform" {
  name      = "abra_platform"
  server_id = azurerm_postgresql_flexible_server.this.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

resource "azurerm_container_app_environment" "this" {
  name                       = "${var.naming_prefix}-cae"
  resource_group_name        = azurerm_resource_group.this.name
  location                   = azurerm_resource_group.this.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id

  tags = var.tags
}

data "azurerm_client_config" "current" {}
