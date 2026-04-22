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

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
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

variable "postgres_admin_password" {
  description = "Administrator password for the PostgreSQL server"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.postgres_admin_password) >= 12
    error_message = "postgres_admin_password must be at least 12 characters."
  }
}

variable "postgres_subnet_id" {
  description = "Delegated subnet ID for PostgreSQL private connectivity"
  type        = string
  default     = null
}

variable "postgres_private_dns_zone_id" {
  description = "Private DNS zone ID for PostgreSQL private connectivity"
  type        = string
  default     = null
}
