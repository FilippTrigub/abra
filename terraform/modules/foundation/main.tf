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
  retention_in_days   = 30
  sku                 = "PerGB2018"

  tags = var.tags
}

resource "azurerm_container_registry" "this" {
  admin_enabled       = false
  location            = azurerm_resource_group.this.location
  name                = "${var.naming_prefix}acr${local.random_suffix}"
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "Standard"

  tags = var.tags
}

resource "azurerm_storage_account" "app" {
  account_kind               = "StorageV2"
  account_replication_type   = "GRS"
  account_tier               = "Standard"
  https_traffic_only_enabled = true
  location                   = azurerm_resource_group.this.location
  min_tls_version            = "TLS1_2"
  name                       = "${var.naming_prefix}stapp${local.random_suffix}"
  resource_group_name        = azurerm_resource_group.this.name
  shared_access_key_enabled  = true

  blob_properties {
    delete_retention_policy {
      days = 7
    }

    versioning_enabled = true
  }

  network_rules {
    bypass         = ["AzureServices"]
    default_action = "Deny"
  }

  tags = var.tags
}

resource "azurerm_storage_container" "archive" {
  container_access_type = "private"
  name                  = "archive"
  storage_account_name  = azurerm_storage_account.app.name
}

resource "azurerm_storage_container" "brand_assets" {
  container_access_type = "private"
  name                  = "brand-assets"
  storage_account_name  = azurerm_storage_account.app.name
}

resource "azurerm_storage_container" "input" {
  container_access_type = "private"
  name                  = "input"
  storage_account_name  = azurerm_storage_account.app.name
}

resource "azurerm_storage_container" "output" {
  container_access_type = "private"
  name                  = "output"
  storage_account_name  = azurerm_storage_account.app.name
}

resource "azurerm_storage_container" "runpod_staging" {
  container_access_type = "private"
  name                  = "runpod-staging"
  storage_account_name  = azurerm_storage_account.app.name
}

resource "azurerm_servicebus_namespace" "this" {
  location            = azurerm_resource_group.this.location
  name                = "${var.naming_prefix}-sbns"
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "Standard"

  tags = var.tags
}

resource "azurerm_servicebus_queue" "job_completion" {
  max_delivery_count = 10
  name               = "job-completion"
  namespace_id       = azurerm_servicebus_namespace.this.id
}

resource "azurerm_servicebus_queue" "job_dispatch" {
  max_delivery_count = 10
  name               = "job-dispatch"
  namespace_id       = azurerm_servicebus_namespace.this.id
}

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "this" {
  enabled_for_disk_encryption = false
  location                    = azurerm_resource_group.this.location
  name                        = "${var.naming_prefix}-kv"
  purge_protection_enabled    = false
  resource_group_name         = azurerm_resource_group.this.name
  sku_name                    = "standard"
  soft_delete_retention_days  = 90
  tenant_id                   = data.azurerm_client_config.current.tenant_id

  network_acls {
    bypass         = "AzureServices"
    default_action = "Deny"
  }

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server" "this" {
  administrator_login    = var.postgres_admin_user
  administrator_password = var.postgres_admin_password
  location               = azurerm_resource_group.this.location
  name                   = "${var.naming_prefix}-psql"
  resource_group_name    = azurerm_resource_group.this.name
  sku_name               = "B_Standard_B1ms"
  storage_mb             = 32768
  version                = "16"
  zone                   = "1"

  tags = var.tags
}

resource "azurerm_postgresql_flexible_server_database" "platform" {
  charset   = "utf8"
  collation = "en_US.utf8"
  name      = "abra_platform"
  server_id = azurerm_postgresql_flexible_server.this.id
}

resource "azurerm_kubernetes_cluster" "this" {
  dns_prefix          = "${var.naming_prefix}-aks"
  kubernetes_version  = var.kubernetes_version
  location            = azurerm_resource_group.this.location
  name                = "${var.naming_prefix}-aks"
  resource_group_name = azurerm_resource_group.this.name
  sku_tier            = var.aks_sku_tier

  default_node_pool {
    enable_auto_scaling         = true
    max_count                   = var.aks_max_node_count
    max_pods                    = var.aks_max_pods
    min_count                   = var.aks_min_node_count
    name                        = "system"
    node_count                  = var.aks_default_node_count
    os_disk_size_gb             = var.aks_os_disk_size_gb
    orchestrator_version        = var.kubernetes_version
    temporary_name_for_rotation = "rotate"
    vm_size                     = var.aks_node_vm_size
  }

  identity {
    type = "SystemAssigned"
  }

  key_vault_secrets_provider {
    secret_rotation_enabled = true
  }

  network_profile {
    load_balancer_sku = "standard"
    network_plugin    = "azure"
    network_policy    = "azure"
    service_cidr      = var.aks_service_cidr
    dns_service_ip    = var.aks_dns_service_ip
  }

  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
  }

  oidc_issuer_enabled               = true
  role_based_access_control_enabled = true
  workload_identity_enabled         = true

  api_server_access_profile {
    authorized_ip_ranges = var.api_server_authorized_ip_ranges
  }

  tags = var.tags
}
