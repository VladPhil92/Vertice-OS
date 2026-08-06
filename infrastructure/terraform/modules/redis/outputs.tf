output "redis_endpoint" {
  description = "DNS hostname of the primary ElastiCache Redis node."
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "redis_port" {
  description = "Port the ElastiCache Redis cluster listens on."
  value       = aws_elasticache_cluster.main.cache_nodes[0].port
}

output "redis_cluster_id" {
  description = "ID of the ElastiCache cluster."
  value       = aws_elasticache_cluster.main.cluster_id
}

output "redis_connection_url" {
  description = "Redis connection URL using TLS (transit_encryption_enabled = true). Inject AUTH token via application config."
  value       = "rediss://${aws_elasticache_cluster.main.cache_nodes[0].address}:${aws_elasticache_cluster.main.cache_nodes[0].port}"
}

output "security_group_id" {
  description = "ID of the security group attached to the ElastiCache cluster."
  value       = aws_security_group.redis.id
}

output "subnet_group_name" {
  description = "Name of the ElastiCache subnet group."
  value       = aws_elasticache_subnet_group.main.name
}
