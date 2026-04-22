resource "azurerm_user_assigned_identity" "router" {
  name                = "${var.naming_prefix}-router-identity"
  resource_group_name = var.resource_group_name
  location            = var.location

  tags = var.tags
}

resource "azurerm_container_app" "router" {
  name                         = "${var.naming_prefix}-router"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = var.environment_id
  revision_mode                = "Single"

  secret {
    name  = "acr-password"
    value = var.acr_admin_password
  }

  registry {
    server               = var.acr_login_server
    username             = var.acr_admin_username
    password_secret_name = "acr-password"
  }

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "router"
      image  = var.router_image
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "KEY_VAULT_URL"
        value = var.key_vault_uri
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 80
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.router.id]
  }

  lifecycle {
    ignore_changes = [
      template.0.container.0.env,
    ]
  }

  tags = var.tags
}
