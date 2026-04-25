provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }

    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = false
    }
  }
}

module "foundation" {
  source = "../../modules/foundation"

  aks_default_node_count          = var.aks_default_node_count
  aks_dns_service_ip              = var.aks_dns_service_ip
  aks_max_node_count              = var.aks_max_node_count
  aks_max_pods                    = var.aks_max_pods
  aks_min_node_count              = var.aks_min_node_count
  aks_node_vm_size                = var.aks_node_vm_size
  aks_os_disk_size_gb             = var.aks_os_disk_size_gb
  aks_service_cidr                = var.aks_service_cidr
  aks_sku_tier                    = var.aks_sku_tier
  api_server_authorized_ip_ranges = var.api_server_authorized_ip_ranges
  kubernetes_version              = var.kubernetes_version
  location                        = var.location
  naming_prefix                   = var.naming_prefix
  postgres_admin_password         = var.postgres_admin_password
  postgres_admin_user             = var.postgres_admin_user
  postgres_private_dns_zone_id    = null
  postgres_subnet_id              = null
  tags                            = var.tags
}
