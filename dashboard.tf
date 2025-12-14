################################################################################
# CloudWatch Dashboard
# A "Single Pane of Glass" to visualize security events
# Free Tier Limit: 3 Dashboards, 50 metrics per dashboard.
################################################################################

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "Cloud-Audit-Zero-Dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # Widget 1: The "Heartbeat" (S3 Events Triggered)
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            [ "AWS/Events", "Invocations", "RuleName", aws_cloudwatch_event_rule.s3_detection.name ]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          title   = "Security Events Detected (EventBridge)"
          period  = 300
        }
      },
      # Widget 2: The "Muscle" (Remediations Performed)
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            [ "AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.remediator.function_name, { "color": "#2ca02c" } ]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          title   = "Remediations Performed (Lambda)"
          period  = 300
        }
      },
      # Widget 3: The "Health" (Errors)
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          metrics = [
            [ "AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.remediator.function_name, { "color": "#d62728", "label": "Remediator Errors" } ],
            [ "AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.validator.function_name, { "color": "#ff7f0e", "label": "Validator Errors" } ]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          title   = "System Health (Errors)"
          period  = 300
        }
      }
    ]
  })
}