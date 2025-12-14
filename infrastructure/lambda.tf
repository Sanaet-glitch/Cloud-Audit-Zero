################################################################################
# DATA: Zip the Python source code
################################################################################

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../src/remediate.py"
  output_path = "${path.module}/../src/remediate.zip"
}

data "archive_file" "validate_zip" {
  type        = "zip"
  source_file = "${path.module}/../src/validate.py"
  output_path = "${path.module}/../src/validate.zip"
}

################################################################################
# LAMBDA FUNCTIONS
################################################################################

# 1. The Remediator (Fixes the problem)
resource "aws_lambda_function" "remediator" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "cloud-audit-zero-remediator"
  role             = aws_iam_role.lambda_role.arn
  handler          = "remediate.lambda_handler"
  runtime          = "python3.9"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 10
}

# 2. The Validator (Checks the problem)
resource "aws_lambda_function" "validator" {
  filename         = data.archive_file.validate_zip.output_path
  function_name    = "cloud-audit-zero-validator"
  role             = aws_iam_role.lambda_role.arn
  handler          = "validate.lambda_handler"
  runtime          = "python3.9"
  source_code_hash = data.archive_file.validate_zip.output_base64sha256
  timeout          = 10
}

################################################################################
# IAM Role & Permissions (The "Identity" for the Lambda)
################################################################################

# 1. The Role: Who can assume this? (The Lambda Service)
resource "aws_iam_role" "lambda_role" {
  name = "cloud-audit-zero-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# 2. The Policy: What can it do? (First Check S3 Buckets, then fix S3 Buckets)
resource "aws_iam_policy" "remediate_policy" {
  name        = "cloud-audit-zero-remediate-policy"
  description = "Allows Lambda to block public access on S3 buckets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # Allow basic logging (so we can debug)
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        # Allow Listing all buckets
        Action = [
          "s3:ListAllMyBuckets"
        ]
        Effect   = "Allow"
        Resource = "*"
      },
      {
        # Allow checking and fixing the bucket (Least Privilege)
        Action = [
          "s3:PutBucketPublicAccessBlock",
          "s3:GetBucketPublicAccessBlock",
          "s3:ListBucket"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:s3:::*"
      }
    ]
  })
}

# 3. Attach the Policy to the Role
resource "aws_iam_role_policy_attachment" "attach_remediate" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.remediate_policy.arn
}