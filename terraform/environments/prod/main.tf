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

  location                     = var.location
  naming_prefix                = var.naming_prefix
  tags                         = var.tags
  postgres_admin_user          = var.postgres_admin_user
  postgres_admin_password      = var.postgres_admin_password
  postgres_subnet_id           = null
  postgres_private_dns_zone_id = null
}

module "router" {
  source = "../../modules/router"

  resource_group_name = module.foundation.resource_group_name
  location            = module.foundation.resource_group_location
  naming_prefix       = var.naming_prefix
  environment_id      = module.foundation.container_apps_environment_id
  router_image        = var.router_image
  acr_login_server    = module.foundation.container_registry_login_server
  acr_admin_username  = var.acr_admin_username
  acr_admin_password  = var.acr_admin_password
  key_vault_uri       = module.foundation.key_vault_uri
  key_vault_id        = module.foundation.key_vault_id
  tags                = var.tags
}

module "agents" {
  for_each = var.users

  source = "../../modules/agent"

  resource_group_name      = module.foundation.resource_group_name
  location                 = module.foundation.resource_group_location
  naming_prefix            = var.naming_prefix
  environment_id           = module.foundation.container_apps_environment_id
  agent_image              = var.agent_image
  user_id                  = each.key
  blob_prefix              = each.value.blob_prefix
  agent_port               = 8080
  key_vault_id             = module.foundation.key_vault_id
  key_vault_uri            = module.foundation.key_vault_uri
  acr_login_server         = module.foundation.container_registry_login_server
  acr_admin_username       = var.acr_admin_username
  acr_admin_password       = var.acr_admin_password
  runpod_api_key           = each.value.runpod_api_key
  backblaze_b2_bucket_name = each.value.backblaze_b2_bucket_name
  backblaze_b2_key_id      = var.backblaze_b2_key_id
  backblaze_b2_app_key     = var.backblaze_b2_app_key
  tags                     = merge(var.tags, { user_id = each.key })
}
