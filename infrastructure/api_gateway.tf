# 1. The API Gateway ("The Door")
resource "aws_apigatewayv2_api" "main_api" {
  name          = "cloud-audit-zero-api"
  protocol_type = "HTTP"

  # CORS Configuration - Crucial for Vercel connectivity (Allows Vercel Frontend to talk to AWS)
  cors_configuration {
    allow_origins = ["*"] # STRICTLY for dev. Change to your Vercel URL in prod.
    allow_methods = ["POST", "GET", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
}

# 2. The Stage - This is the "environment" (e.g., dev/prod)
resource "aws_apigatewayv2_stage" "dev" {
  api_id      = aws_apigatewayv2_api.main_api.id
  name        = "$default" # Auto-deploys changes immediately
  auto_deploy = true
}

# ---------------------------------------------------------
# Integration: Connect API to Remediate Lambda
# ---------------------------------------------------------

# 1. The Bridge (Integration)
resource "aws_apigatewayv2_integration" "remediator_integration" {
  api_id           = aws_apigatewayv2_api.main_api.id
  integration_type = "AWS_PROXY"
  
  # IMPORTANT: Ensure 'aws_lambda_function.remediator' matches your lambda.tf
  integration_uri    = aws_lambda_function.remediator.invoke_arn
  integration_method = "POST" 
}

# 2. The Route (URL Path): POST /remediate -> Triggers Lambda
# This allows the frontend to POST to https://.../remediate
resource "aws_apigatewayv2_route" "remediator_route" {
  api_id    = aws_apigatewayv2_api.main_api.id
  route_key = "POST /remediate"
  target    = "integrations/${aws_apigatewayv2_integration.remediator_integration.id}"
}

# 3. Permission (Allow API Gateway to invoke Lambda)
resource "aws_lambda_permission" "api_gw_remediator" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.remediator.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.main_api.execution_arn}/*/*/remediate"
}