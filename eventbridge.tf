################################################################################
# EventBridge Rule: The "Trigger"
################################################################################

resource "aws_cloudwatch_event_rule" "s3_detection" {
  name        = "cloud-audit-zero-s3-guard"
  description = "Triggers Step Function when an S3 bucket is compromised"

  # The "Event Pattern" - This is the filter
  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["AWS API Call via CloudTrail"]
    detail = {
      eventSource = ["s3.amazonaws.com"]
      eventName   = [
        "CreateBucket",                  # Trigger on new buckets
        "DeleteBucketPublicAccessBlock", # Trigger if someone removes security
        "PutBucketAcl",                  # Trigger if someone changes permissions
        "PutBucketPublicAccessBlock"   
      ]
    }
  })
}

################################################################################
# IAM Role for EventBridge
# (EventBridge needs permission to "StartExecution" of the workflow)
################################################################################

resource "aws_iam_role" "eventbridge_role" {
  name = "cloud-audit-zero-eb-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "events.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_policy" "eb_policy" {
  name        = "cloud-audit-zero-eb-policy"
  description = "Allows EventBridge to start the specific Step Function"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "states:StartExecution"
        Resource = aws_sfn_state_machine.sfn_workflow.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach_eb" {
  role       = aws_iam_role.eventbridge_role.name
  policy_arn = aws_iam_policy.eb_policy.arn
}

################################################################################
# Target: Connect EventBridge to Step Functions
################################################################################

resource "aws_cloudwatch_event_target" "trigger_sfn" {
  rule      = aws_cloudwatch_event_rule.s3_detection.name
  target_id = "TriggerStepFunction"
  arn       = aws_sfn_state_machine.sfn_workflow.arn
  role_arn  = aws_iam_role.eventbridge_role.arn
}