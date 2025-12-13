################################################################################
# IAM Role for Step Functions
# This gives the "Manager" permission to boss around the "Workers" (Lambdas)
################################################################################

resource "aws_iam_role" "step_function_role" {
  name = "cloud-audit-zero-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "states.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_policy" "sfn_policy" {
  name        = "cloud-audit-zero-sfn-policy"
  description = "Allows Step Functions to invoke specific Lambdas"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "lambda:InvokeFunction"
        Resource = [
          aws_lambda_function.validator.arn,
          aws_lambda_function.remediator.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem"
        ]
        Resource = [
          aws_dynamodb_table.audit_log.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_sfn" {
  role       = aws_iam_role.step_function_role.name
  policy_arn = aws_iam_policy.sfn_policy.arn
}

################################################################################
# The State Machine (The Workflow)
################################################################################

resource "aws_sfn_state_machine" "sfn_workflow" {
  name     = "CloudAuditZero-Workflow"
  role_arn = aws_iam_role.step_function_role.arn

  definition = jsonencode({
    Comment = "Orchestrates the detection and remediation of S3 security issues"
    StartAt = "ValidateBucket"
    States = {
      # Step 1: Call the Validator Lambda
      ValidateBucket = {
        Type     = "Task"
        Resource = aws_lambda_function.validator.arn
        Next     = "IsBucketPublic?"
        # Pass the input straight through
        InputPath = "$"
      }

      # Step 2: Decision Logic (The Brain)
      "IsBucketPublic?" = {
        Type = "Choice"
        Choices = [
          {
            Variable = "$.is_public"
            BooleanEquals = true
            Next = "RemediateBucket"
          }
        ]
        # If it's NOT public, just end successfully
        Default = "AuditComplete_Safe"
      }

      # Step 3: Call the Remediator (Only if Public)
      RemediateBucket = {
        Type     = "Task"
        Resource = aws_lambda_function.remediator.arn
        Next     = "LogRemediation"
        ResultPath = "$.remediation_result"
      }

      # Step 4: Log to DynamoDB (Direct Integration)
      LogRemediation = {
        Type = "Task"
        Resource = "arn:aws:states:::dynamodb:putItem"
        Parameters = {
          TableName = aws_dynamodb_table.audit_log.name
          Item = {
            RequestId = { "S.$": "$$.Execution.Id" }
            Timestamp = { "S.$": "$$.State.EnteredTime" }
            BucketName = { "S.$": "$.bucket_name" }
            Action = { "S": "Remediated Public Access" }
            Status = { "S": "Success" }
          }
        }
        End = true
      }

      # Step 5: No Action Needed
      AuditComplete_Safe = {
        Type = "Pass"
        Result = "Bucket is secure. No action taken."
        End = true
      }
    }
  })
}