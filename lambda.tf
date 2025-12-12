################################################################################
# Lambda Function: Remediator
################################################################################

# 1. Zip the Python code (Lambda requires a zip file)
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/src/remediate.py"
  output_path = "${path.module}/src/remediate.zip"
}

# 2. The Lambda Function
resource "aws_lambda_function" "remediator" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "cloud-audit-zero-remediator"
  role             = aws_iam_role.lambda_role.arn
  handler          = "remediate.lambda_handler"
  runtime          = "python3.9"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
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

# 2. The Policy: What can it do? (Fix S3 Buckets)
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
        # Allow fixing the bucket (Least Privilege)
        Action = [
          "s3:PutBucketPublicAccessBlock"
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