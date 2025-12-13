################################################################################
# Terraform Configuration
################################################################################

terraform {
  # 1. Required Version: Ensures we use a modern, stable version of Terraform
  required_version = ">= 1.0.0"

  # 2. Required Providers: Downloads the official code to talk to AWS
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # 3. Backend Configuration: Tells Terraform to store state in S3 (Remote Backend)
  #    This connects the code to the resources you created via CLI.
  backend "s3" {
    bucket         = "cloud-audit-zero-tfstate-sanaet" # Your S3 Bucket Name
    key            = "global/s3/terraform.tfstate"     # The path inside the bucket
    region         = "us-east-1"
    dynamodb_table = "cloud-audit-zero-tf-lock"        # Your DynamoDB Table
    encrypt        = true
  }
}

################################################################################
# Provider Block
################################################################################

# Tells Terraform to target the US East (N. Virginia) region by default
provider "aws" {
  region = "us-east-1"

  # Best Practice: Tag all resources automatically to track costs
  default_tags {
    tags = {
      Project     = "Cloud-Audit-Zero"
      Environment = "Dev"
      ManagedBy   = "Terraform"
    }
  }
}

################################################################################
# Audit Log Database
################################################################################

resource "aws_dynamodb_table" "audit_log" {
  name           = "cloud-audit-zero-logs"
  # Switch to PROVISIONED to strictly align with the "Always Free" tier (25 RCU/WCU limit)
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "RequestId"

  attribute {
    name = "RequestId"
    type = "S"
  }
}