locals {
  agent_name = "${var.naming_prefix}-agent-${var.user_id}"
}

resource "azurerm_user_assigned_identity" "agent" {
  name                = "${var.naming_prefix}-agent-${var.user_id}-identity"
  resource_group_name = var.resource_group_name
  location            = var.location

  tags = var.tags
}

resource "azurerm_container_app" "agent" {
  name                         = local.agent_name
  resource_group_name          = var.resource_group_name
  container_app_environment_id = var.environment_id
  revision_mode                = "Single"

  secret {
    name  = "acr-password"
    value = var.acr_admin_password
  }

  secret {
    name  = "runpod-api-key"
    value = var.runpod_api_key
  }

  secret {
    name  = "b2-bucket-name"
    value = var.backblaze_b2_bucket_name
  }

  registry {
    server               = var.acr_login_server
    username             = var.acr_admin_username
    password_secret_name = "acr-password"
  }

  template {
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "agent"
      image  = var.agent_image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "USER_ID"
        value = var.user_id
      }

      env {
        name  = "BLOB_PREFIX"
        value = var.blob_prefix
      }

      env {
        name  = "KEY_VAULT_URL"
        value = var.key_vault_uri
      }

      env {
        name        = "RUNPOD_API_KEY"
        secret_name = "runpod-api-key"
      }

      env {
        name        = "BACKBLAZE_B2_RUNPOD_BUCKET_NAME"
        secret_name = "b2-bucket-name"
      }
    }
  }

  ingress {
    external_enabled = false
    target_port      = var.agent_port
    transport        = "auto"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.agent.id]
  }

  lifecycle {
    ignore_changes = [
      template.0.container.0.env,
    ]
  }

  tags = var.tags
}

resource "azurerm_key_vault_secret" "runpod_api_key" {
  name         = "runpod-api-key-${var.user_id}"
  key_vault_id = var.key_vault_id
  value        = var.runpod_api_key
  tags         = var.tags
}

resource "azurerm_key_vault_secret" "b2_bucket_name" {
  name         = "b2-bucket-name-${var.user_id}"
  key_vault_id = var.key_vault_id
  value        = var.backblaze_b2_bucket_name
  tags         = var.tags
}

resource "azurerm_key_vault_secret" "b2_key_id" {
  name         = "b2-key-id-${var.user_id}"
  key_vault_id = var.key_vault_id
  value        = var.backblaze_b2_key_id
  tags         = var.tags
}

resource "azurerm_key_vault_secret" "b2_app_key" {
  name         = "b2-app-key-${var.user_id}"
  key_vault_id = var.key_vault_id
  value        = var.backblaze_b2_app_key
  tags         = var.tags
}
