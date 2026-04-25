# Terraform AKS Migration Plan

This document provides a concrete, file-by-file implementation plan to adapt the current Container Apps-based Terraform to an AKS-oriented foundation matching the design in `.docs/aks-abra-agent-deployment-plan.md`.

**Scope**: Infrastructure only. No Helm charts or Kubernetes workload manifests unless clearly justified as foundational. The platform/orchestrator code will manage the actual OpenClaw runtimes via Kubernetes APIs.

---

## Summary of Changes

| Category | Action | Files |
|---|---|---|
| **Replace** | Foundation module (add AKS cluster) | `modules/foundation/main.tf` |
| **Add** | AKS-specific module | `modules/aks-cluster/` |
| **Add** | Storage foundation module | `modules/aks-storage/` |
| **Add** | Network foundation module | `modules/aks-network/` |
| **Replace** | Agent module (StatefulSet foundation) | `modules/agent/` → `modules/agent-runtime/` |
| **Replace** | Router module (gateway integration) | `modules/router/` → `modules/gateway/` |
| **Modify** | Environment variables/outputs | `environments/prod/` + outputs |
| **Add** | Namespace configuration | `modules/aks-namespace/` |
| **Remove** | Container Apps Environment resources | Foundation module cleanup |

---

## Module Replacement Strategy

### 1. Foundation Module (`modules/foundation/`)

**Current**: Creates CAE (Container Apps Environment), ACR, Storage, Service Bus, Key Vault, PostgreSQL, Log Analytics

**New**: Add AKS cluster + Node Pools; keep shared services (ACR, Storage, KV, PSQl, Service Bus)

#### File: `modules/foundation/main.tf`

**Add**:
```hcl
# AKS Cluster
resource "azurerm_kubernetes_cluster" "this" {
  name                = "${var.naming_prefix}-aks"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  dns_prefix          = "${var.naming_prefix}-aks"
  kubernetes_version  = var.kubernetes_version

  agent_pool {
    name                = "system"
    type                = "VirtualMachineScaleSets"
    vm_size             = var.aks_vm_size
    vnet_subnet_id      = var.aks_system_subnet_id
    max_pods            = 30
    node_count          = var.aks_system_node_count
    min_count           = var.aks_system_min_nodes
    max_count           = var.aks_system_max_nodes
    enable_auto_scaling = true
   OsDiskType           = "Managed"
    OsDiskSizeGB         = var.aks_os_disk_size_gb
    node_labels         = var.aks_system_node_labels
    tags                = var.aks_system_node_tags
  }

  identity {
    type = "SystemAssigned"
  }

  default_addon {
    metrics {
      enabled = true
      kube_metrics {
        autoscale     = true
        custom_metrics = true
      }
    }
    http_application_routing { enabled = false }
    oms_agent {
      enabled                    = true
      log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
    }
  }

  network_profile {
    network_plugin     = "azure"
    network_policy     = "calico"
    load_balancer_sku  = "standard"
    outbound_type      = "loadBalancer"
    dns_service_ip     = var.dns_service_ip
    service_cidr       = var.service_cidr
  }

  private_cluster_enabled               = false
  local_account_disabled                = true
  oauth2_admin_access_enabled           = false
  api_server_authorized_ip_ranges       = var.api_server_allowed_ip_ranges
  azure_active_directory_role_based_access_control {
    azure_rbac_enabled         = true
    admin_group_object_ids     = var.aad_admin_group_object_ids
    managed_aad                = true
    enable_group_claim         = true
  }

  oms_agent {
    enabled                    = true
    log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
  }

  tags = var.tags
}

# AKS Node Resource Group (managed by Azure)
output "node_resource_group" {
  value = azurerm_kubernetes_cluster.this.node_resource_group
}
```

**Keep unchanged**:
- `azurerm_resource_group.this`
- `azurerm_log_analytics_workspace.this`
- `azurerm_container_registry.this`
- `azurerm_storage_account.app` + containers
- `azurerm_servicebus_namespace.this` + queues
- `azurerm_key_vault.this`
- `azurerm_postgresql_flexible_server.this` + database

**Remove**:
- `azurerm_container_app_environment.this` (no longer needed for AKS)

#### File: `modules/foundation/variables.tf`

**Add**:
```hcl
variable "kubernetes_version" {
  description = "Kubernetes version for AKS"
  type        = string
  default     = "1.30"
}

variable "aks_vm_size" {
  description = "AKS node pool VM size"
  type        = string
  default     = "Standard_D4s_v3"
}

variable "aks_system_node_count" {
  description = "Initial node count for system pool"
  type        = number
  default     = 1
}

variable "aks_system_min_nodes" {
  description = "Minimum node count for autoscaling"
  type        = number
  default     = 1
}

variable "aks_system_max_nodes" {
  description = "Maximum node count for autoscaling"
  type        = number
  default     = 3
}

variable "aks_os_disk_size_gb" {
  description = "OS disk size for AKS nodes"
  type        = number
  default     = 64
}

variable "aks_system_subnet_id" {
  description = "Delegated subnet ID for AKS system pool (private AKS)"
  type        = string
  default     = null
}

variable "aks_system_node_labels" {
  description = "Node labels for system pool"
  type        = map(string)
  default     = {}
}

variable "aks_system_node_tags" {
  description = "Node tags for system pool"
  type        = map(string)
  default     = {}
}

variable "dns_service_ip" {
  description = "Kubernetes Service IP address"
  type        = string
  default     = "10.0.0.10"
}

variable "service_cidr" {
  description = "Kubernetes Service CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "api_server_allowed_ip_ranges" {
  description = "Allowed IP ranges for API server"
  type        = set(string)
  default     = []
}

variable "aad_admin_group_object_ids" {
  description = "AAD group object IDs for admin access"
  type        = list(string)
  default     = []
}
```

**Update**:
- Remove `postgres_subnet_id` and `postgres_private_dns_zone_id` (keep as-is but can be enhanced later for private PostgreSQL)

#### File: `modules/foundation/outputs.tf`

**Add**:
```hcl
output "kubernetes_cluster_id" {
  description = "Resource ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.this.id
}

output "kubernetes_cluster_name" {
  description = "Name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.this.name
}

output "kubernetes_cluster_fqdn" {
  description = "FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.this.fqdn
}

output "kubernetes_cluster_node_resource_group" {
  description = "Node resource group name (for managing node pools separately)"
  value       = azurerm_kubernetes_cluster.this.node_resource_group
}

output "kubernetes_cluster_default_pool_id" {
  description = "Resource ID of the default agent pool"
  value       = azurerm_kubernetes_cluster.this.default_agent_pool_ids[0]
}

output "kubernetes_cluster_private_fqdn" {
  description = "Private FQDN (empty if public)"
  value       = azurerm_kubernetes_cluster.this.private_fqdn
}
```

**Remove**:
- `container_apps_environment_id` (Container Apps Environment removed)

---

### 2. New AKS Storage Module (`modules/aks-storage/`)

**Purpose**: Manages storage classes and default PVC templates for Abra runtime state

#### File: `modules/aks-storage/main.tf` (NEW)

```hcl
resource "azurerm_storage_account" "aks_pvc" {
  count = var.enable_pvc_storage ? 1 : 0

  name                     = "${var.naming_prefix}pvc${random_id.hex.hex}"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "BlobStorage"

  blob_properties {
    container_delete_retention_policy {
      enabled = true
      days    = 7
    }
  }

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
  }

  tags = var.tags
}

resource "azurerm_storage_container" "pvc_data" {
  count = var.enable_pvc_storage ? 1 : 0

  name                  = "pvc-data"
  storage_account_name  = azurerm_storage_account.aks_pvc[0].name
  container_access_type = "private"
}

resource "kubernetes_storage_class" "pvc_standard" {
  count = var.enable_k8s_storage_class ? 1 : 0

  metadata {
    name = "pvc-standard"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = var.is_default_storage_class ? "true" : "false"
    }
  }

  storage_provisioner = "kubernetes.io/azure-disk"

  parameters = {
    skuName              = "Standard_LRS"
    storageaccounttype   = "Standard_LRS"
    kind                 = "Managed"
    cstor-disk-type      = "SSD"
  }

  reclaim_policy  = "Delete"
  volume_binding_mode = "WaitForFirstConsumer"
}

resource "kubernetes_storage_class" "pvc_premium" {
  count = var.enable_k8s_storage_class && var.enable_premium_storage ? 1 : 0

  metadata {
    name = "pvc-premium"
    annotations = {
      "storageclass.kubernetes.io/is-default-class" = "false"
    }
  }

  storage_provisioner = "kubernetes.io/azure-disk"

  parameters = {
    skuName              = "Premium_LRS"
    storageaccounttype   = "Premium_LRS"
    kind                 = "Managed"
    cstor-disk-type      = "SSD"
  }

  reclaim_policy  = "Delete"
  volume_binding_mode = "WaitForFirstConsumer"
}
```

#### File: `modules/aks-storage/variables.tf` (NEW)

```hcl
variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "naming_prefix" {
  description = "Short prefix for resource naming"
  type        = string
}

variable "enable_pvc_storage" {
  description = "Create dedicated storage account for PVCs"
  type        = bool
  default     = true
}

variable "enable_k8s_storage_class" {
  description = "Create Kubernetes storage classes"
  type        = bool
  default     = true
}

variable "enable_premium_storage" {
  description = "Create premium storage class"
  type        = bool
  default     = true
}

variable "is_default_storage_class" {
  description = "Make pvc-standard the default storage class"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
```

#### File: `modules/aks-storage/outputs.tf` (NEW)

```hcl
output "storage_account_name" {
  description = "Name of the PVC storage account"
  value       = var.enable_pvc_storage ? azurerm_storage_account.aks_pvc[0].name : null
}

output "storage_account_id" {
  description = "Resource ID of the PVC storage account"
  value       = var.enable_pvc_storage ? azurerm_storage_account.aks_pvc[0].id : null
}

output "storage_container_name" {
  description = "Name of the PVC data container"
  value       = var.enable_pvc_storage ? azurerm_storage_container.pvc_data[0].name : null
}

output "storage_class_names" {
  description = "Names of created storage classes"
  value = {
    standard = var.enable_k8s_storage_class ? "pvc-standard" : null
    premium  = var.enable_k8s_storage_class && var.enable_premium_storage ? "pvc-premium" : null
  }
}
```

---

### 3. New AKS Network Module (`modules/aks-network/`)

**Purpose**: Network policies, ingress controller setup, and private DNS

#### File: `modules/aks-network/main.tf` (NEW)

```hcl
resource "kubernetes_network_policy" "agent_isolation" {
  count = var.enable_network_policies ? 1 : 0

  metadata {
    name      = "agent-isolation"
    namespace = var.namespace_name
  }

  spec {
    pod_selector {
      match_labels = {
        app = "abra-agent"
      }
    }

    policy_types = ["Ingress", "Egress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            name = var.gateway_namespace
          }
        }
      }

      to {
        port {
          number = var.agent_port
        }
      }
    }

    egress {
      to {
        port {
          number = 443
        }
      }
    }
  }
}

resource "kubernetes_service" "agent_internal" {
  count = var.enable_internal_services ? 1 : 0

  metadata {
    name      = "agent-service"
    namespace = var.namespace_name
  }

  spec {
    selector = {
      app = "abra-agent"
    }

    port {
      port        = var.agent_port
      target_port = var.agent_port
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}
```

#### File: `modules/aks-network/variables.tf` (NEW)

```hcl
variable "namespace_name" {
  description = "Kubernetes namespace name"
  type        = string
}

variable "gateway_namespace" {
  description = "Namespace containing the gateway"
  type        = string
  default     = "abra-gateway"
}

variable "enable_network_policies" {
  description = "Enable Kubernetes network policies"
  type        = bool
  default     = true
}

variable "enable_internal_services" {
  description = "Create internal cluster-IP services"
  type        = bool
  default     = true
}

variable "agent_port" {
  description = "Agent container port"
  type        = number
  default     = 8080
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
```

---

### 4. New AKS Namespace Module (`modules/aks-namespace/`)

**Purpose**: Creates the dedicated namespace for Abra agents

#### File: `modules/aks-namespace/main.tf` (NEW)

```hcl
resource "kubernetes_namespace" "abra_agents" {
  metadata {
    name = var.namespace_name

    labels = {
      name = var.namespace_name
      managed-by = "terraform"
    }

    annotations = var.namespace_annotations
  }
}
```

#### File: `modules/aks-namespace/variables.tf` (NEW)

```hcl
variable "namespace_name" {
  description = "Name of the Kubernetes namespace"
  type        = string
}

variable "namespace_labels" {
  description = "Labels to apply to the namespace"
  type        = map(string)
  default     = {}
}

variable "namespace_annotations" {
  description = "Annotations to apply to the namespace"
  type        = map(string)
  default     = {}
}
```

#### File: `modules/aks-namespace/outputs.tf` (NEW)

```hcl
output "namespace_id" {
  description = "ID of the namespace (same as name)"
  value       = kubernetes_namespace.abra_agents.id
}

output "namespace_name" {
  description = "Name of the namespace"
  value       = kubernetes_namespace.abra_agents.metadata[0].name
}
```

---

### 5. Agent Runtime Module (`modules/agent-runtime/`)

**Purpose**: Foundation for per-user StatefulSet and PVC (NOT the actual StatefulSet - that goes in platform code)

This module provisions the **infrastructure** for StatefulSet-based runtimes: identity, secrets, and persistent storage bindings. It does NOT create the Kubernetes StatefulSet manifest (that's platform code).

#### File: `modules/agent-runtime/main.tf` (NEW)

```hcl
locals {
  agent_name = "${var.naming_prefix}-agent-${var.user_id}"
}

# Kubernetes Service Account for agent
resource "kubernetes_service_account" "agent" {
  metadata {
    name      = local.agent_name
    namespace = var.namespace_name

    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.agent.client_id
    }
  }
}

# Azure User-Assigned Identity for agent
resource "azurerm_user_assigned_identity" "agent" {
  name                = "${var.naming_prefix}-agent-${var.user_id}-identity"
  resource_group_name = var.resource_group_name
  location            = var.location

  tags = var.tags
}

# Azure Policy Assignment for identity permissions
resource "azurerm_role_assignment" "agent_blob_contributor" {
  scope                = var.storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.agent.principal_id
}

resource "azurerm_role_assignment" "agent_key_vault_secrets" {
  scope                = var.key_vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.agent.principal_id
}

# Key Vault Secrets for agent credentials
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
```

#### File: `modules/agent-runtime/variables.tf` (NEW)

```hcl
variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "naming_prefix" {
  description = "Short prefix for resource names"
  type        = string
}

variable "namespace_name" {
  description = "Kubernetes namespace for the agent"
  type        = string
}

variable "user_id" {
  description = "Unique user identifier"
  type        = string
}

variable "blob_prefix" {
  description = "Blob container prefix for this user's files"
  type        = string
}

variable "storage_account_id" {
  description = "Azure Storage account resource ID"
  type        = string
}

variable "key_vault_id" {
  description = "Key Vault resource ID"
  type        = string
}

variable "acr_login_server" {
  description = "ACR login server for image authentication"
  type        = string
}

variable "agent_image" {
  description = "ACR image reference for the agent runtime"
  type        = string
}

variable "agent_port" {
  description = "Agent container port"
  type        = number
  default     = 8080
}

variable "runpod_api_key" {
  description = "RunPod API key for GPU job submission"
  type        = string
  sensitive   = true
}

variable "backblaze_b2_bucket_name" {
  description = "Backblaze B2 bucket name"
  type        = string
  sensitive   = true
}

variable "backblaze_b2_key_id" {
  description = "Backblaze B2 key ID"
  type        = string
  sensitive   = true
}

variable "backblaze_b2_app_key" {
  description = "Backblaze B2 application key"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
```

#### File: `modules/agent-runtime/outputs.tf` (NEW)

```hcl
output "service_account_name" {
  description = "Name of the Kubernetes service account"
  value       = kubernetes_service_account.agent.metadata[0].name
}

output "identity_id" {
  description = "Managed identity resource ID"
  value       = azurerm_user_assigned_identity.agent.id
}

output "identity_client_id" {
  description = "Managed identity client ID (for Azure Workload Identity)"
  value       = azurerm_user_assigned_identity.agent.client_id
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
```

---

### 6. Gateway Module (`modules/gateway/`)

**Purpose**: Replaces Router module; provides foundation for gateway-to-agent routing

**Note**: Like the agent module, this provisions identity and secrets but NOT the actual deployment manifest (platform code handles that)

#### File: `modules/gateway/main.tf` (NEW)

```hcl
resource "azurerm_user_assigned_identity" "gateway" {
  name                = "${var.naming_prefix}-gateway-identity"
  resource_group_name = var.resource_group_name
  location            = var.location

  tags = var.tags
}

# Gateway Service Account with Azure Workload Identity
resource "kubernetes_service_account" "gateway" {
  metadata {
    name      = "${var.naming_prefix}-gateway"
    namespace = var.namespace_name

    annotations = {
      "azure.workload.identity/client-id" = azurerm_user_assigned_identity.gateway.client_id
    }
  }
}

# Role binding for gateway
resource "kubernetes_role" "gateway_role" {
  metadata {
    name      = "gateway-role"
    namespace = var.namespace_name
  }

  rule {
    api_groups = [""]
    resources  = ["pods", "services", "secrets", "configmaps"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "statefulsets"]
    verbs      = ["get", "list", "watch"]
  }
}

resource "kubernetes_role_binding" "gateway_binding" {
  metadata {
    name      = "gateway-binding"
    namespace = var.namespace_name
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "Role"
    name      = kubernetes_role.gateway_role.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.gateway.metadata[0].name
    namespace = var.namespace_name
  }
}
```

#### File: `modules/gateway/variables.tf` (NEW)

```hcl
variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "naming_prefix" {
  description = "Short prefix for resource names"
  type        = string
}

variable "namespace_name" {
  description = "Kubernetes namespace for the gateway"
  type        = string
}

variable "gateway_image" {
  description = "ACR image reference for the gateway"
  type        = string
}

variable "key_vault_id" {
  description = "Key Vault resource ID"
  type        = string
}

variable "acr_login_server" {
  description = "ACR login server for image authentication"
  type        = string
}

variable "acr_admin_username" {
  description = "ACR admin username"
  type        = string
  sensitive   = true
}

variable "acr_admin_password" {
  description = "ACR admin password"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
```

#### File: `modules/gateway/outputs.tf` (NEW)

```hcl
output "service_account_name" {
  description = "Name of the Kubernetes service account"
  value       = kubernetes_service_account.gateway.metadata[0].name
}

output "identity_id" {
  description = "Managed identity resource ID"
  value       = azurerm_user_assigned_identity.gateway.id
}

output "identity_client_id" {
  description = "Managed identity client ID"
  value       = azurerm_user_assigned_identity.gateway.client_id
}
```

---

## Environment File Changes (`environments/prod/`)

### File: `environments/prod/variables.tf`

**Replace**:
```hcl
variable "acr_login_server" {
  description = "ACR login server URL"
  type        = string
}

variable "runpod_api_key" {
  description = "Global RunPod API key"
  type        = string
  sensitive   = true
}

variable "runpod_endpoint_ids" {
  description = "Map of per-skill RunPod endpoint IDs"
  type        = map(string)
  default     = {}
}

variable "backblaze_b2_key_id" {
  description = "Backblaze B2 key ID for RunPod staging"
  type        = string
  sensitive   = true
}

variable "backblaze_b2_app_key" {
  description = "Backblaze B2 application key for RunPod staging"
  type        = string
  sensitive   = true
}

variable "backblaze_b2_bucket_name" {
  description = "Backblaze B2 bucket name for RunPod staging"
  type        = string
  sensitive   = true
}

variable "users" {
  description = "Map of users to onboard. Each entry creates a per-user agent."
  type = map(object({
    display_name             = string
    blob_prefix              = string
    runpod_api_key           = string
    backblaze_b2_bucket_name = string
  }))
  default = {}
}
```

**Add**:
```hcl
variable "kubernetes_version" {
  description = "AKS Kubernetes version"
  type        = string
  default     = "1.30"
}

variable "aks_system_node_count" {
  description = "Initial system node count"
  type        = number
  default     = 1
}

variable "aks_system_min_nodes" {
  description = "Minimum system nodes for autoscaling"
  type        = number
  default     = 1
}

variable "aks_system_max_nodes" {
  description = "Maximum system nodes for autoscaling"
  type        = number
  default     = 3
}

variable "namespace_name" {
  description = "Kubernetes namespace for Abra agents"
  type        = string
  default     = "abra-agents"
}

variable "gateway_namespace" {
  description = "Kubernetes namespace for gateway"
  type        = string
  default     = "abra-gateway"
}

variable "enable_network_policies" {
  description = "Enable Kubernetes network policies"
  type        = bool
  default     = true
}

variable "enable_premium_storage" {
  description = "Enable premium storage class"
  type        = bool
  default     = true
}
```

### File: `environments/prod/main.tf`

**Replace**:
```hcl
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
```

**Replace with**:
```hcl
module "foundation" {
  source = "../../modules/foundation"

  location                     = var.location
  naming_prefix                = var.naming_prefix
  tags                         = var.tags
  postgres_admin_user          = var.postgres_admin_user
  postgres_admin_password      = var.postgres_admin_password
  kubernetes_version           = var.kubernetes_version
  aks_system_node_count        = var.aks_system_node_count
  aks_system_min_nodes         = var.aks_system_min_nodes
  aks_system_max_nodes         = var.aks_system_max_nodes
  aks_system_subnet_id         = null
  aks_system_node_labels       = {}
  aks_system_node_tags         = {}
}

module "aks_namespace" {
  source = "../../modules/aks-namespace"

  namespace_name = var.namespace_name
  tags           = var.tags
}

module "aks_storage" {
  source = "../../modules/aks-storage"

  resource_group_name    = module.foundation.resource_group_name
  location               = module.foundation.resource_group_location
  naming_prefix          = var.naming_prefix
  enable_pvc_storage     = true
  enable_k8s_storage_class = true
  enable_premium_storage = var.enable_premium_storage
  is_default_storage_class = true
  tags                   = var.tags
}

module "aks_network" {
  source = "../../modules/aks-network"

  namespace_name          = var.namespace_name
  gateway_namespace       = var.gateway_namespace
  enable_network_policies = var.enable_network_policies
  enable_internal_services = true
  agent_port              = 8080
  tags                    = var.tags
}

module "gateway" {
  source = "../../modules/gateway"

  resource_group_name = module.foundation.resource_group_name
  location            = module.foundation.resource_group_location
  naming_prefix       = var.naming_prefix
  namespace_name      = var.gateway_namespace
  gateway_image       = var.gateway_image
  key_vault_id        = module.foundation.key_vault_id
  acr_login_server    = module.foundation.container_registry_login_server
  acr_admin_username  = var.acr_admin_username
  acr_admin_password  = var.acr_admin_password
  tags                = var.tags
}

module "agent_runtimes" {
  for_each = var.users

  source = "../../modules/agent-runtime"

  resource_group_name      = module.foundation.resource_group_name
  location                 = module.foundation.resource_group_location
  naming_prefix            = var.naming_prefix
  namespace_name           = var.namespace_name
  agent_image              = var.agent_image
  user_id                  = each.key
  blob_prefix              = each.value.blob_prefix
  storage_account_id       = module.foundation.storage_account_id
  key_vault_id             = module.foundation.key_vault_id
  acr_login_server         = module.foundation.container_registry_login_server
  agent_port               = 8080
  runpod_api_key           = each.value.runpod_api_key
  backblaze_b2_bucket_name = each.value.backblaze_b2_bucket_name
  backblaze_b2_key_id      = var.backblaze_b2_key_id
  backblaze_b2_app_key     = var.backblaze_b2_app_key
  tags                     = merge(var.tags, { user_id = each.key })
}
```

### File: `environments/prod/outputs.tf`

**Replace**:
```hcl
output "router_container_app_id" {
  description = "Resource ID of the public router Container App"
  value       = module.router.container_app_id
}

output "router_default_hostname" {
  description = "Public hostname of the router Container App"
  value       = module.router.default_hostname
}

output "agent_container_app_names" {
  description = "Names of all per-user agent Container Apps"
  value       = { for k, v in module.agents : k => v.container_app_name }
}
```

**Replace with**:
```hcl
output "kubernetes_cluster_id" {
  description = "Resource ID of the AKS cluster"
  value       = module.foundation.kubernetes_cluster_id
}

output "kubernetes_cluster_name" {
  description = "Name of the AKS cluster"
  value       = module.foundation.kubernetes_cluster_name
}

output "kubernetes_cluster_fqdn" {
  description = "FQDN of the AKS cluster"
  value       = module.foundation.kubernetes_cluster_fqdn
}

output "gateway_service_account_name" {
  description = "Name of the gateway Kubernetes service account"
  value       = module.gateway.service_account_name
}

output "gateway_identity_id" {
  description = "Gateway managed identity ID"
  value       = module.gateway.identity_id
}

output "agent_runtime_service_accounts" {
  description = "Names of agent runtime service accounts by user"
  value       = { for k, v in module.agent_runtimes : k => v.service_account_name }
}

output "agent_runtime_identity_ids" {
  description = "Agent runtime identity IDs by user"
  value       = { for k, v in module.agent_runtimes : k => v.identity_id }
}

output "pvc_storage_class_names" {
  description = "Names of PVC storage classes"
  value       = module.aks_storage.storage_class_names
}
```

---

## Minimum Viable AKS Resources: Now vs Deferred

### Phase 1: Terraform-Only Foundation (Provision Now)

These resources are infrastructure-only and should be provisioned via Terraform immediately:

| Resource | Module | Purpose |
|---|---|---|
| AKS cluster + system node pool | `modules/foundation` | Core compute platform |
| AKS namespace (`abra-agents`) | `modules/aks-namespace` | Resource isolation |
| Storage account + PVC container | `modules/aks-storage` | PVC backing |
| Storage classes (standard/premium) | `modules/aks-storage` | Dynamic provisioning |
| Gateway identity + service account | `modules/gateway` | Control-plane auth |
| Per-user identities + service accounts | `modules/agent-runtime` | Runtime auth |
| Network policies | `modules/aks-network` | Isolation |
| Key Vault secrets (RunPod, B2) | `modules/agent-runtime` / `foundation` | Credential storage |

**Do NOT provision via Terraform** (leave for platform/orchestrator):
- StatefulSet manifests for OpenClaw runtimes
- Deployment manifests for gateway
- ConfigMaps for runtime configuration
- Secrets for runtime credentials (use Azure Workload Identity)
- Init container images (pull from ACR, but manifest is platform code)
- Ingress controller (use Azure Application Gateway Ingress Controller or nginx)

---

## Variables/Outputs Migration Summary

### Variables to Remove
- `acr_login_server` in `agent` module → replaced by `acr_login_server` in `agent-runtime` (kept)
- `environment_id` (Container Apps Environment) → removed entirely
- `key_vault_uri` in agent module → replaced by `key_vault_id` + service account pattern
- `user_id` in agent module → kept in `agent-runtime`
- `runpod_endpoint_ids` at environment level → kept, but injected via ConfigMap (platform code)

### Variables to Add
- `kubernetes_version` → foundation module
- `aks_system_node_count`, `aks_system_min_nodes`, `aks_system_max_nodes` → foundation module
- `namespace_name` → environment + all K8s modules
- `gateway_namespace` → environment + network module
- `enable_network_policies` → environment + network module
- `enable_premium_storage` → environment + storage module
- `agent_image` in `agent-runtime` → per-user runtime image (kept from original)
- `gateway_image` in `gateway` → gateway image reference (NEW)

### Outputs to Remove
- `container_apps_environment_id` → foundation module
- `container_app_id`, `container_app_name`, `latest_revision_fqdn` → all modules
- `default_hostname` → router/gateway module

### Outputs to Add
- `kubernetes_cluster_id`, `kubernetes_cluster_name`, `kubernetes_cluster_fqdn` → foundation
- `service_account_name` → gateway, agent-runtime
- `identity_id`, `identity_client_id` → gateway, agent-runtime
- `storage_class_names` → aks-storage
- `namespace_name` → aks-namespace

---

## Implementation Order

1. **Create new modules**: `aks-namespace`, `aks-storage`, `aks-network`
2. **Update `foundation` module**: Add AKS cluster, remove CAE
3. **Create `gateway` module**: Identity + service account foundation
4. **Create `agent-runtime` module**: Identity + service account foundation
5. **Update `environments/prod/variables.tf`**: Add AKS variables
6. **Update `environments/prod/main.tf`**: Wire all new modules
7. **Update `environments/prod/outputs.tf`**: New K8s outputs
8. **Validate**: `terraform fmt -recursive`, `terraform validate`

---

## Validation Checklist

- [ ] `terraform fmt -recursive` passes
- [ ] `terraform validate` passes for all modules
- [ ] `terraform plan -var-file=prod.tfvars` succeeds
- [ ] Verify AKS cluster can be created (test in dev first)
- [ ] Verify storage classes are available in AKS
- [ ] Verify Azure Workload Identity pattern works with identities

---

## Notes on Scope Boundaries

**Terraform Owns**:
- Azure infrastructure (AKS, identity, storage, networking)
- Kubernetes namespace and storage classes
- Service accounts with Azure Workload Identity annotations

**Platform/Orchestrator Code Owns**:
- StatefulSet manifests (created/updated via Kubernetes API)
- Init container images and logic
- ConfigMaps for runtime configuration
- Direct pod orchestration (create/update/restart/destroy)
- Readiness probe configuration and status mapping

This separation keeps Terraform as **infrastructure provisioner** while allowing the platform to manage **runtime lifecycle** via native Kubernetes APIs, matching the deployment plan's requirement for orchestrated stateful runtimes.
