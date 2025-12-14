################################################################################
# S3 Honeypot Resource
# This bucket acts as the "bait" for our security monitoring system.
################################################################################

# 1. Random Suffix to ensure global uniqueness for the bucket name
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# 2. The S3 Bucket itself
resource "aws_s3_bucket" "honeypot" {
  bucket = "cloud-audit-zero-honeypot-${random_string.suffix.result}"

  # Force destroy allows us to delete the bucket even if it has files in it
  # (Useful for development/testing projects like this)
  force_destroy = true

  tags = {
    Name        = "Honeypot Trap"
    Description = "DO NOT USE - Security Decoy"
  }
}

# 3. Security Controls (Public Access Block)
# We block all public access by default.
resource "aws_s3_bucket_public_access_block" "honeypot" {
  bucket = aws_s3_bucket.honeypot.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

################################################################################
# Outputs
################################################################################

# This will print the bucket name to the console after we deploy
output "honeypot_bucket_name" {
  value       = aws_s3_bucket.honeypot.id
  description = "The name of the honeypot bucket"
}