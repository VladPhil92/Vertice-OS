# ---------------------------------------------------------------------------
# VÉRTICE OS — RDS Module (PostgreSQL 16 + PostGIS)
# ---------------------------------------------------------------------------
# Creates:
#   - DB subnet group in private subnets
#   - Security group allowing port 5432 from EKS nodes only
#   - Parameter group for PostgreSQL 16 with postgis-aware settings
#   - RDS PostgreSQL 16 instance with encryption and multi-AZ
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# DB Subnet Group
# ---------------------------------------------------------------------------

resource "aws_db_subnet_group" "main" {
  name        = "${var.project}-${var.environment}-db-subnet-group"
  description = "Subnet group for ${var.project} ${var.environment} RDS instance."
  subnet_ids  = var.private_subnet_ids

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-db-subnet-group"
  })
}

# ---------------------------------------------------------------------------
# Security Group — only EKS nodes may reach PostgreSQL
# ---------------------------------------------------------------------------

resource "aws_security_group" "rds" {
  name        = "${var.project}-${var.environment}-rds-sg"
  description = "Allow PostgreSQL access from EKS worker nodes only."
  vpc_id      = var.vpc_id

  ingress {
    description             = "PostgreSQL from EKS worker nodes."
    from_port               = 5432
    to_port                 = 5432
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
    Name = "${var.project}-${var.environment}-rds-sg"
  })
}

# ---------------------------------------------------------------------------
# Parameter Group — PostgreSQL 16
# PostGIS itself is loaded via the migration script (infrastructure/db/init.sql)
# using CREATE EXTENSION IF NOT EXISTS postgis; — it does not require a
# shared_preload_libraries entry because it is a trusted extension.
# ---------------------------------------------------------------------------

resource "aws_db_parameter_group" "postgres16" {
  name        = "${var.project}-${var.environment}-pg16"
  family      = "postgres16"
  description = "Custom parameter group for ${var.project} ${var.environment} PostgreSQL 16."

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_duration"
    value = "0"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries that take more than 1 second
  }

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
    # PostGIS extension is activated via CREATE EXTENSION in init.sql migration.
    # Adding postgis to shared_preload_libraries is not required and would
    # cause RDS to reject the parameter group on instances without PostGIS.
    apply_method = "pending-reboot"
  }

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-pg16-param-group"
  })
}

# ---------------------------------------------------------------------------
# RDS Instance
# ---------------------------------------------------------------------------

resource "aws_db_instance" "main" {
  identifier = "${var.project}-${var.environment}-postgres"

  engine         = "postgres"
  engine_version = "16.3"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2 # Enable storage autoscaling up to 2x
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  # Set multi_az = true in production for automatic failover to a standby replica.
  # Set to false in staging to reduce costs.
  multi_az = var.multi_az

  backup_retention_period = 7
  backup_window           = "03:00-04:00" # UTC
  maintenance_window      = "Mon:04:00-Mon:05:00"

  auto_minor_version_upgrade = true
  copy_tags_to_snapshot      = true

  # Set deletion_protection = false in non-production environments to allow
  # terraform destroy. Enable it unconditionally in production.
  deletion_protection = var.deletion_protection

  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project}-${var.environment}-postgres-final-snapshot"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-postgres"
  })
}
