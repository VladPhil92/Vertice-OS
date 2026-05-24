variable "project" {
  description = "Project identifier used as a prefix for resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g. staging, production)."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "availability_zones" {
  description = "List of 3 AWS Availability Zones for subnet placement."
  type        = list(string)
}

variable "common_tags" {
  description = "Common tags to apply to all resources in this module."
  type        = map(string)
  default     = {}
}
