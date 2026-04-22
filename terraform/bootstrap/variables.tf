variable "location" {
  description = "Azure region for bootstrap resources"
  type        = string
  default     = "northeurope"

  validation {
    condition     = var.location != ""
    error_message = "location must not be empty."
  }
}

variable "naming_prefix" {
  description = "Short prefix used in resource names (a-z, 0-9, max 6 chars)"
  type        = string
  default     = "abra"

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
