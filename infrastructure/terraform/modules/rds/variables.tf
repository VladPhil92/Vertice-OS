variable "project" {
  description = "Project identifier used as a prefix for resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g. staging, production)."
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where the RDS instance will be deployed."
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets for the DB subnet group."
  type        = list(string)
}

variable "eks_node_security_group_id" {
  description = "Security group ID of the EKS worker nodes. Only this SG is allowed inbound access on port 5432."
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class (e.g. db.t3.medium, db.r6g.large)."
  type        = string
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for the RDS instance in gigabytes."
  type        = number
}

variable "db_name" {
  description = "Name of the initial PostgreSQL database."
  type        = string
}

variable "db_username" {
  description = "Master username for the RDS PostgreSQL instance."
  type        = string
}

variable "db_password" {
  description = "Master password for the RDS PostgreSQL instance."
  type        = string
  sensitive   = true
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment for RDS high availability. Set true in production, false in staging to reduce costs."
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection on the RDS instance. Set true in production, false in non-production to allow terraform destroy."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip the final DB snapshot when the instance is deleted. Set to false in production."
  type        = bool
  default     = true
}

variable "common_tags" {
  description = "Common tags to apply to all resources in this module."
  type        = map(string)
  default     = {}
}
