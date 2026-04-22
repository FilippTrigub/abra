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

variable "router_image" {
  description = "Full ACR image reference (e.g., abraacr01.azurecr.io/abrarouter:latest)"
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

variable "key_vault_uri" {
  description = "Key Vault URI for secret resolution"
  type        = string
}

variable "key_vault_id" {
  description = "Key Vault resource ID"
  type        = string
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
  default     = {}
}
