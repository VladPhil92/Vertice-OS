output "db_endpoint" {
  description = "Connection endpoint for the RDS instance in host:port format."
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  description = "Hostname of the RDS instance (without port)."
  value       = aws_db_instance.main.address
}

output "db_port" {
  description = "Port the RDS instance listens on."
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "Name of the PostgreSQL database."
  value       = aws_db_instance.main.db_name
}

output "db_instance_id" {
  description = "Identifier of the RDS instance."
  value       = aws_db_instance.main.identifier
}

output "db_instance_arn" {
  description = "ARN of the RDS instance."
  value       = aws_db_instance.main.arn
}

output "security_group_id" {
  description = "ID of the security group attached to the RDS instance."
  value       = aws_security_group.rds.id
}

output "db_subnet_group_name" {
  description = "Name of the DB subnet group."
  value       = aws_db_subnet_group.main.name
}
