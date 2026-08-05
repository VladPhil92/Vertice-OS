#!/usr/bin/env bash
# infrastructure/terraform/bootstrap.sh
#
# Creates the AWS resources needed for Terraform remote state BEFORE the first
# `terraform init`. Run once per environment (staging / production).
#
# Usage:
#   AWS_REGION=us-east-1 TF_STATE_BUCKET=vertice-os-terraform-state ./bootstrap.sh
#
# Required env vars (with defaults):
#   AWS_REGION        — AWS region for the bucket and DynamoDB table (default: us-east-1)
#   TF_STATE_BUCKET   — S3 bucket name for Terraform state           (default: vertice-os-terraform-state)
#   TF_LOCK_TABLE     — DynamoDB table name for state locking         (default: vertice-os-terraform-locks)

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
BUCKET_NAME="${TF_STATE_BUCKET:-vertice-os-terraform-state}"
DYNAMO_TABLE="${TF_LOCK_TABLE:-vertice-os-terraform-locks}"

echo "=== VÉRTICE OS — Terraform Bootstrap ==="
echo "Region: $AWS_REGION | Bucket: $BUCKET_NAME | DynamoDB: $DYNAMO_TABLE"
echo ""

# ── 1. Verify AWS credentials ──────────────────────────────────────────────────

echo "[1/5] Verifying AWS credentials..."
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
echo "      Account: $ACCOUNT_ID"

# ── 2. S3 bucket ──────────────────────────────────────────────────────────────

echo "[2/5] Ensuring S3 bucket: $BUCKET_NAME"
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "      Bucket already exists — skipping creation."
else
  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$AWS_REGION"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET_NAME" \
      --region "$AWS_REGION" \
      --create-bucket-configuration LocationConstraint="$AWS_REGION"
  fi
  echo "      Bucket created."
fi

# ── 3. Versioning ─────────────────────────────────────────────────────────────

echo "[3/5] Enabling versioning on $BUCKET_NAME"
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled
echo "      Done."

# ── 4. Encryption + public-access block ───────────────────────────────────────

echo "[4/5] Hardening bucket (encryption + public-access block)"
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": { "SSEAlgorithm": "aws:kms" },
      "BucketKeyEnabled": true
    }]
  }'

aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "      Done."

# ── 5. DynamoDB table for state locking ───────────────────────────────────────

echo "[5/5] Ensuring DynamoDB lock table: $DYNAMO_TABLE"
if aws dynamodb describe-table --table-name "$DYNAMO_TABLE" --region "$AWS_REGION" \
    --query 'Table.TableStatus' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "      Table already exists — skipping creation."
else
  aws dynamodb create-table \
    --table-name "$DYNAMO_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$AWS_REGION"

  echo "      Waiting for table to become ACTIVE..."
  aws dynamodb wait table-exists --table-name "$DYNAMO_TABLE" --region "$AWS_REGION"
  echo "      Table ready."
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "Bootstrap complete. Next steps:"
echo ""
echo "  1. Copy the example vars file:"
echo "     cp infrastructure/terraform/terraform.tfvars.example infrastructure/terraform/terraform.tfvars"
echo ""
echo "  2. Fill in real values in terraform.tfvars"
echo ""
echo "  3. Initialize Terraform with remote state:"
echo "     cd infrastructure/terraform"
echo "     terraform init \\"
echo "       -backend-config=\"bucket=${BUCKET_NAME}\" \\"
echo "       -backend-config=\"region=${AWS_REGION}\" \\"
echo "       -backend-config=\"dynamodb_table=${DYNAMO_TABLE}\""
echo ""
echo "  4. Plan and apply:"
echo "     terraform plan -var-file=terraform.tfvars"
echo "     terraform apply -var-file=terraform.tfvars"
