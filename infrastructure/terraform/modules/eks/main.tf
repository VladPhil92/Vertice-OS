# ---------------------------------------------------------------------------
# VÉRTICE OS — EKS Module
# ---------------------------------------------------------------------------
# Creates:
#   - IAM roles for the cluster control plane and worker nodes
#   - EKS cluster with private endpoint enabled
#   - Managed node group in private subnets
#   - Core EKS add-ons: coredns, kube-proxy, vpc-cni, aws-ebs-csi-driver
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# IAM — Cluster role
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "eks_cluster_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "eks_cluster" {
  name               = "${var.project}-${var.environment}-eks-cluster-role"
  assume_role_policy = data.aws_iam_policy_document.eks_cluster_assume_role.json

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-eks-cluster-role"
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

# ---------------------------------------------------------------------------
# IAM — Node group role
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "eks_nodes_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "eks_nodes" {
  name               = "${var.project}-${var.environment}-eks-nodes-role"
  assume_role_policy = data.aws_iam_policy_document.eks_nodes_assume_role.json

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-eks-nodes-role"
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "eks_ecr_read_only" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

# EBS CSI Driver requires additional EC2 permissions for node group role
resource "aws_iam_role_policy_attachment" "eks_ebs_csi_policy" {
  role       = aws_iam_role.eks_nodes.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}

# ---------------------------------------------------------------------------
# Security group — Cluster control plane
# ---------------------------------------------------------------------------

resource "aws_security_group" "eks_cluster" {
  name        = "${var.project}-${var.environment}-eks-cluster-sg"
  description = "Security group for the EKS cluster control plane."
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound traffic from the control plane."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-eks-cluster-sg"
  })
}

# Allow HTTPS from node security group to cluster API
resource "aws_security_group_rule" "cluster_inbound_from_nodes" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.eks_nodes.id
  security_group_id        = aws_security_group.eks_cluster.id
  description              = "Allow worker nodes to communicate with the cluster API server."
}

# ---------------------------------------------------------------------------
# Security group — Node group
# ---------------------------------------------------------------------------

resource "aws_security_group" "eks_nodes" {
  name        = "${var.project}-${var.environment}-eks-nodes-sg"
  description = "Security group for EKS managed worker nodes."
  vpc_id      = var.vpc_id

  ingress {
    description = "Allow all intra-node communication."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  ingress {
    description             = "Allow control plane to communicate with worker nodes (kubelet, etc.)."
    from_port               = 1025
    to_port                 = 65535
    protocol                = "tcp"
    security_groups         = [aws_security_group.eks_cluster.id]
  }

  egress {
    description = "Allow all outbound traffic from worker nodes."
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-eks-nodes-sg"
  })
}

# ---------------------------------------------------------------------------
# EKS Cluster
# ---------------------------------------------------------------------------

resource "aws_eks_cluster" "main" {
  name     = "${var.project}-${var.environment}"
  version  = var.eks_cluster_version
  role_arn = aws_iam_role.eks_cluster.arn

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    security_group_ids      = [aws_security_group.eks_cluster.id]
    endpoint_private_access = true
    # Public endpoint is enabled to allow kubectl access from CI/CD and
    # developer workstations. Restrict to known CIDRs in production by
    # populating public_access_cidrs.
    endpoint_public_access  = true
    public_access_cidrs     = var.eks_public_access_cidrs
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-eks"
  })

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
  ]
}

# ---------------------------------------------------------------------------
# EKS Managed Node Group
# ---------------------------------------------------------------------------

resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${var.project}-${var.environment}-nodes"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = var.private_subnet_ids
  instance_types  = var.eks_node_instance_types

  scaling_config {
    min_size     = var.eks_node_min_size
    max_size     = var.eks_node_max_size
    desired_size = var.eks_node_desired_size
  }

  update_config {
    max_unavailable = 1
  }

  launch_template {
    id      = aws_launch_template.eks_nodes.id
    version = aws_launch_template.eks_nodes.latest_version
  }

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-eks-node-group"
  })

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_ecr_read_only,
    aws_iam_role_policy_attachment.eks_ebs_csi_policy,
  ]
}

# Launch template for node group — allows custom root volume size and SG
resource "aws_launch_template" "eks_nodes" {
  name_prefix   = "${var.project}-${var.environment}-eks-lt-"
  description   = "Launch template for EKS worker nodes."

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = 50
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  vpc_security_group_ids = [aws_security_group.eks_nodes.id]

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # Enforce IMDSv2
    http_put_response_hop_limit = 2
  }

  tags = merge(var.common_tags, {
    Name = "${var.project}-${var.environment}-eks-lt"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# ---------------------------------------------------------------------------
# EKS Add-ons
# ---------------------------------------------------------------------------

resource "aws_eks_addon" "coredns" {
  cluster_name                = aws_eks_cluster.main.name
  addon_name                  = "coredns"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = var.common_tags

  depends_on = [aws_eks_node_group.main]
}

resource "aws_eks_addon" "kube_proxy" {
  cluster_name                = aws_eks_cluster.main.name
  addon_name                  = "kube-proxy"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = var.common_tags
}

resource "aws_eks_addon" "vpc_cni" {
  cluster_name                = aws_eks_cluster.main.name
  addon_name                  = "vpc-cni"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = var.common_tags
}

resource "aws_eks_addon" "aws_ebs_csi_driver" {
  cluster_name                = aws_eks_cluster.main.name
  addon_name                  = "aws-ebs-csi-driver"
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "OVERWRITE"

  tags = var.common_tags

  depends_on = [aws_iam_role_policy_attachment.eks_ebs_csi_policy]
}
