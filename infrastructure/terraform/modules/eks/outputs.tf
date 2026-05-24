output "cluster_name" {
  description = "Name of the EKS cluster."
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "API server endpoint for the EKS cluster."
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded certificate authority data for the EKS cluster."
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_arn" {
  description = "ARN of the EKS cluster."
  value       = aws_eks_cluster.main.arn
}

output "node_group_arn" {
  description = "ARN of the EKS managed node group."
  value       = aws_eks_node_group.main.arn
}

output "node_security_group_id" {
  description = "ID of the security group attached to EKS worker nodes. Used by RDS and Redis to allow inbound traffic from the cluster."
  value       = aws_security_group.eks_nodes.id
}

output "cluster_security_group_id" {
  description = "ID of the security group attached to the EKS control plane."
  value       = aws_security_group.eks_cluster.id
}

output "eks_nodes_role_arn" {
  description = "ARN of the IAM role used by EKS worker nodes."
  value       = aws_iam_role.eks_nodes.arn
}
