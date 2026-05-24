variable "project" {
  description = "Project identifier used as a prefix for resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment name (e.g. staging, production)."
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where the EKS cluster will be deployed."
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets for EKS worker nodes."
  type        = list(string)
}

variable "eks_cluster_version" {
  description = "Kubernetes version for the EKS cluster."
  type        = string
}

variable "eks_node_instance_types" {
  description = "EC2 instance types for the managed node group."
  type        = list(string)
}

variable "eks_node_min_size" {
  description = "Minimum number of worker nodes."
  type        = number
}

variable "eks_node_max_size" {
  description = "Maximum number of worker nodes."
  type        = number
}

variable "eks_node_desired_size" {
  description = "Desired number of worker nodes."
  type        = number
}

variable "eks_public_access_cidrs" {
  description = "List of CIDR blocks allowed to access the EKS public API endpoint. Restrict to known IPs in production."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "common_tags" {
  description = "Common tags to apply to all resources in this module."
  type        = map(string)
  default     = {}
}
