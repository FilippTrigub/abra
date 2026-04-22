resource "azurerm_resource_group" "this" {
  name     = "${var.naming_prefix}-rg-bootstrap"
  location = var.location

  tags = var.tags
}

resource "azurerm_storage_account" "this" {
  name                     = "${var.naming_prefix}tfstate${random_id.suffix.hex}"
  resource_group_name      = azurerm_resource_group.this.name
  location                 = azurerm_resource_group.this.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"

  tags = var.tags
}

resource "azurerm_storage_container" "state" {
  name                  = "tf-state"
  storage_account_name  = azurerm_storage_account.this.name
  container_access_type = "private"
}

resource "random_id" "suffix" {
  byte_length = 3
}
