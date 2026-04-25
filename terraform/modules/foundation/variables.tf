variable "aks_default_node_count" {
  description = "Initial node count for the AKS system pool"
  type        = number
  default     = 1
}

variable "aks_dns_service_ip" {
  description = "Cluster DNS service IP inside the AKS service CIDR"
  type        = string
  default     = "10.0.0.10"
}

variable "aks_max_node_count" {
  description = "Maximum node count for the AKS system pool autoscaler"
  type        = number
  default     = 3
}

variable "aks_max_pods" {
  description = "Maximum pods per AKS node"
  type        = number
  default     = 30
}

variable "aks_min_node_count" {
  description = "Minimum node count for the AKS system pool autoscaler"
  type        = number
  default     = 1
}

variable "aks_node_vm_size" {
  description = "VM size for the AKS system pool"
  type        = string
  default     = "Standard_D4s_v5"
}

variable "aks_os_disk_size_gb" {
  description = "OS disk size in GB for AKS nodes"
  type        = number
  default     = 128
}

variable "aks_service_cidr" {
  description = "Kubernetes service CIDR for the AKS cluster"
  type        = string
  default     = "10.0.0.0/16"
}

variable "aks_sku_tier" {
  description = "AKS SKU tier"
  type        = string
  default     = "Free"

  validation {
    condition     = contains(["Free", "Standard"], var.aks_sku_tier)
    error_message = "aks_sku_tier must be Free or Standard."
  }
}

variable "api_server_authorized_ip_ranges" {
  description = "Optional list of public CIDR ranges allowed to reach the AKS API server"
  type        = list(string)
  default     = []
}

variable "kubernetes_version" {
  description = "Kubernetes version for the AKS cluster"
  type        = string
  default     = "1.30.0"
}

variable "location" {
  description = "Azure region for foundation resources"
  type        = string

  validation {
    condition     = var.location != ""
    error_message = "location must not be empty."
  }
}

variable "naming_prefix" {
  description = "Short prefix used in resource names (a-z, 0-9, max 6 chars)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{1,6}$", var.naming_prefix))
    error_message = "naming_prefix must be 1-6 lowercase alphanumeric characters."
  }
}

variable "postgres_admin_password" {
  description = "Administrator password for the PostgreSQL server"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.postgres_admin_password) >= 12
    error_message = "postgres_admin_password must be at least 12 characters."
  }
}

variable "postgres_admin_user" {
  description = "Administrator login for the PostgreSQL server"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.postgres_admin_user) >= 3
    error_message = "postgres_admin_user must be at least 3 characters."
  }
}

variable "postgres_private_dns_zone_id" {
  description = "Private DNS zone ID for PostgreSQL private connectivity"
  type        = string
  default     = null
}

variable "postgres_subnet_id" {
  description = "Delegated subnet ID for PostgreSQL private connectivity"
  type        = string
  default     = null
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}
