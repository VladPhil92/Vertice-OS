variable "project" {
  description = "Project identifier used as a prefix for resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g. staging, production)."
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where the ElastiCache cluster will be deployed."
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets for the ElastiCache subnet group."
  type        = list(string)
}

variable "eks_node_security_group_id" {
  description = "Security group ID of the EKS worker nodes. Only this SG is allowed inbound access on port 6379."
  type        = string
}

variable "redis_node_type" {
  description = "ElastiCache node type (e.g. cache.t3.micro, cache.r6g.large)."
  type        = string
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in the ElastiCache cluster. Must be 1 for Redis (cluster mode disabled). Use aws_elasticache_replication_group for multi-node Redis."
  type        = number
  default     = 1

  validation {
    condition     = var.redis_num_cache_nodes == 1
    error_message = "aws_elasticache_cluster with engine=redis supports only 1 node. Use aws_elasticache_replication_group for multi-node Redis with replication."
  }
}

variable "common_tags" {
  description = "Common tags to apply to all resources in this module."
  type        = map(string)
  default     = {}
}
