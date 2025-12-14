################################################################################
# CloudWatch Log Groups
# Manages retention to prevent infinite storage costs (Free Tier Best Practice)
################################################################################

resource "aws_cloudwatch_log_group" "remediator_logs" {
  name              = "/aws/lambda/cloud-audit-zero-remediator"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "validator_logs" {
  name              = "/aws/lambda/cloud-audit-zero-validator"
  retention_in_days = 14
}