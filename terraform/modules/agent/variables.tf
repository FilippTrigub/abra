variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "naming_prefix" {
  description = "Short prefix used in resource names"
  type        = string
}

variable "environment_id" {
  description = "Container Apps Environment resource ID"
  type        = string
}

variable "agent_image" {
  description = "Full ACR image reference for the agent"
  type        = string
}

variable "user_id" {
  description = "Unique user identifier"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9_-]+$", var.user_id))
    error_message = "user_id must be alphanumeric with underscores or hyphens only."
  }
}

variable "blob_prefix" {
  description = "Blob container prefix for this user's files"
  type        = string

  validation {
    condition     = length(var.blob_prefix) > 0 && length(var.blob_prefix) <= 128
    error_message = "blob_prefix must be 1-128 characters."
  }
}

variable "agent_port" {
  description = "Container port the agent listens on"
  type        = number
  default     = 8080
}

variable "key_vault_id" {
  description = "Key Vault resource ID"
  type        = string
}

variable "key_vault_uri" {
  description = "Key Vault URI for secret resolution"
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

variable "runpod_api_key" {
  description = "RunPod API key for GPU job submission"
  type        = string
  sensitive   = true
}

variable "backblaze_b2_bucket_name" {
  description = "Backblaze B2 bucket name for RunPod staging"
  type        = string
  sensitive   = true
}

variable "backblaze_b2_key_id" {
  description = "Backblaze B2 key ID for staging"
  type        = string
  sensitive   = true
}

variable "backblaze_b2_app_key" {
  description = "Backblaze B2 application key for staging"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
