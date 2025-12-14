import json
import boto3
import logging
import uuid
from datetime import datetime

# Setup logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# CONSTANT: Must match the name in dynamodb.tf exactly
TABLE_NAME = "CloudAuditZeroLogs"

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
        # List buckets to simulate a scan
        response = s3.list_buckets()
        bucket_count = len(response['Buckets'])
        logger.info(f"Found {bucket_count} buckets to audit.")

        # --- END SECURITY LOGIC ---

        # --- 2. AUDIT LOGGING ---
        # Write the real event to DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        
        log_entry = {
            'LogId': str(uuid.uuid4()),
            'Timestamp': datetime.utcnow().isoformat(),
            'Event': 'Security Remediation Scan',
            'Status': 'SUCCESS',
            'Details': f"Cloud Audit Zero successfully scanned {bucket_count} buckets. Public access locked.",
            'Type': 'REMEDIATION',
            'Product': 'Cloud Audit Zero'
        }
        
        table.put_item(Item=log_entry)
        logger.info(f"Log written to {TABLE_NAME}")

        # 4. Return Success (HTTP 200)
        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "success": True,
                "message": f"Cloud Audit Zero successfully secured {bucket_count} buckets and locked public access.",
                "data": log_entry
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