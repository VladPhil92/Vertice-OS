# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------

output "vpc_id" {
  description = "ID of the VPC created for VÉRTICE OS."
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets (EKS nodes, RDS, Redis)."
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of the public subnets (load balancers)."
  value       = module.vpc.public_subnet_ids
}

# ---------------------------------------------------------------------------
# EKS
# ---------------------------------------------------------------------------

output "eks_cluster_name" {
  description = "Name of the EKS cluster."
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "API server endpoint for the EKS cluster."
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_certificate_authority_data" {
  description = "Base64-encoded certificate authority data for the EKS cluster."
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "eks_node_group_arn" {
  description = "ARN of the EKS managed node group."
  value       = module.eks.node_group_arn
}

# ---------------------------------------------------------------------------
# RDS
# ---------------------------------------------------------------------------

output "rds_endpoint" {
  description = "Connection endpoint for the RDS PostgreSQL instance (host:port)."
  value       = module.rds.db_endpoint
}

output "rds_db_name" {
  description = "Name of the PostgreSQL database."
  value       = module.rds.db_name
}

output "rds_security_group_id" {
  description = "ID of the security group attached to the RDS instance."
  value       = module.rds.security_group_id
}

# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------

output "redis_endpoint" {
  description = "Connection endpoint for the ElastiCache Redis cluster."
  value       = module.redis.redis_endpoint
}

output "redis_port" {
  description = "Port for the ElastiCache Redis cluster."
  value       = module.redis.redis_port
}

# ---------------------------------------------------------------------------
# Convenience — connection strings for Kubernetes secrets / CI
# ---------------------------------------------------------------------------

output "db_connection_string" {
  description = "PostgreSQL connection string (password omitted — inject from secrets manager)."
  value       = "postgresql://${var.db_username}@${module.rds.db_endpoint}/${var.db_name}"
  sensitive   = false
}
