
resource "aws_dynamodb_table" "audit_logs" {
  name           = "CloudAuditZeroLogs" 
  billing_mode   = "PROVISIONED"        # Strictly for Free Tier compliance
  read_capacity  = 5                    # Free Tier allows up to 25
  write_capacity = 5                    # Free Tier allows up to 25
  hash_key       = "LogId"
  range_key      = "Timestamp"

  attribute {
    name = "LogId"
    type = "S"
  }

  attribute {
    name = "Timestamp"
    type = "S"
  }

  tags = {
    Environment = "Production"
    Project     = "Cloud-Audit-Zero"    
  }
}