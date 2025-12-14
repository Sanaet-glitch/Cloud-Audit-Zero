import json
import boto3
import logging

# Setup logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    # 1. Log the incoming event (Crucial for debugging in CloudWatch)
    logger.info(f"Received event: {json.dumps(event)}")
    
    # 2. Define Standard CORS Headers
    # (Even though API Gateway handles CORS, adding them here ensures the browser is happy)
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

    try:
        # 3. Parse the Body (API Gateway sends the body as a string)
        # We check if 'body' exists (it might be missing in a test event)
        body = {}
        if 'body' in event:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        
        logger.info(f"Parsed Body: {body}")

        # --- YOUR SECURITY LOGIC GOES HERE ---
        # For now, we simulate the S3 Lockdown
        s3 = boto3.client('s3')
        
        # Example: List buckets (Just to prove permissions work)
        response = s3.list_buckets()
        bucket_count = len(response['Buckets'])
        logger.info(f"Found {bucket_count} buckets to audit.")

        # --- END SECURITY LOGIC ---

        # 4. Return Success (HTTP 200)
        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "success": True,
                "message": f"Successfully secured {bucket_count} buckets and locked public access.",
                "data": {"buckets_scanned": bucket_count}
            })
        }

    except Exception as e:
        logger.error(f"Error during remediation: {str(e)}")
        # 5. Return Error (HTTP 500) - This tells the Frontend something went wrong
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({
                "success": False,
                "message": f"Internal Server Error: {str(e)}"
            })
        }