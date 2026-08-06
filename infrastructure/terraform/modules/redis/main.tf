# ---------------------------------------------------------------------------
# VÉRTICE OS — ElastiCache Redis 7 Module
# ---------------------------------------------------------------------------
# Creates:
#   - ElastiCache subnet group in private subnets
#   - Security group allowing port 6379 from EKS nodes only
#   - ElastiCache Redis 7 cluster with encryption at rest and in transit
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# ElastiCache Subnet Group
# ---------------------------------------------------------------------------

resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.project}-${var.environment}-redis-subnet-group"
  description = "Subnet group for ${var.project} ${var.environment} ElastiCache Redis."
  subnet_ids  = var.private_subnet_ids

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-redis-subnet-group"
  })
}

# ---------------------------------------------------------------------------
# Security Group — only EKS nodes may reach Redis
# ---------------------------------------------------------------------------

resource "aws_security_group" "redis" {
  name        = "${var.project}-${var.environment}-redis-sg"
  description = "Allow Redis access from EKS worker nodes only."
  vpc_id      = var.vpc_id

  ingress {
    description             = "Redis from EKS worker nodes."
    from_port               = 6379
    to_port                 = 6379
    protocol                = "tcp"
    security_groups         = [var.eks_node_security_group_id]
  }

  egress {
    description = "Allow all outbound traffic."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-redis-sg"
  })
}

# ---------------------------------------------------------------------------
# ElastiCache Parameter Group — Redis 7
# ---------------------------------------------------------------------------

resource "aws_elasticache_parameter_group" "redis7" {
  name        = "${var.project}-${var.environment}-redis7"
  family      = "redis7"
  description = "Custom parameter group for ${var.project} ${var.environment} Redis 7."

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
    # Evict least recently used keys when memory is full — suitable for
    # caching workloads where the dataset exceeds available memory.
  }

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-redis7-param-group"
  })
}

# ---------------------------------------------------------------------------
# ElastiCache Cluster
# ---------------------------------------------------------------------------

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "${var.project}-${var.environment}-redis"
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_nodes      = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.redis7.name
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption at rest — all data persisted to disk is encrypted.
  at_rest_encryption_enabled = true

  # Encryption in transit — all client-to-node and node-to-node traffic
  # uses TLS. Clients must connect with TLS (rediss:// scheme).
  # Note: When transit_encryption_enabled = true, you may optionally set
  # auth_token to enforce Redis AUTH. For VPC-isolated deployments the
  # security group restriction is the primary access control; AUTH token
  # can be added to the cluster and injected into the app via Secrets Manager.
  transit_encryption_enabled = true

  snapshot_retention_limit = 1
  snapshot_window          = "05:00-06:00" # UTC

  maintenance_window = "sun:06:00-sun:07:00"

  apply_immediately = false

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-redis"
  })
}
