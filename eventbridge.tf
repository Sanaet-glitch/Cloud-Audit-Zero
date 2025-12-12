################################################################################
# EventBridge Rule: The "Trigger"
################################################################################

resource "aws_cloudwatch_event_rule" "s3_detection" {
  name        = "cloud-audit-zero-s3-guard"
  description = "Triggers when an S3 bucket is created or its Public Access Block is deleted"

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
# Target: Connect the Rule to the Lambda
################################################################################

resource "aws_cloudwatch_event_target" "trigger_lambda" {
  rule      = aws_cloudwatch_event_rule.s3_detection.name
  target_id = "SendToRemediator"
  arn       = aws_lambda_function.remediator.arn
}

################################################################################
# Permissions: Allow EventBridge to actually call the Lambda
# (Common newbie mistake: forgetting this resource!)
################################################################################

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.remediator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.s3_detection.arn
}