output "api_endpoint" {
  description = "The public URL for the Cloud Audit Zero API"
  value       = aws_apigatewayv2_api.main_api.api_endpoint
}