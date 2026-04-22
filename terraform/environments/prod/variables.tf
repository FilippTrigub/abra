variable "naming_prefix" {
  description = "Short prefix for all resources (a-z, 0-9, max 6 chars)"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{1,6}$", var.naming_prefix))
    error_message = "naming_prefix must be 1-6 lowercase alphanumeric characters."
  }
}

variable "location" {
  description = "Azure region for resources"
  type        = string
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}

variable "postgres_admin_user" {
  description = "PostgreSQL administrator login"
  type        = string
  sensitive   = true
}

variable "postgres_admin_password" {
  description = "PostgreSQL administrator password"
  type        = string
  sensitive   = true
}

variable "router_image" {
  description = "ACR image reference for the router Container App"
  type        = string
}

variable "agent_image" {
  description = "ACR image reference for agent Container Apps"
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
