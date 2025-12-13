import boto3
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Remediates a vulnerable S3 bucket.
    Handles inputs from both EventBridge (Raw) and Step Functions (Cooked).
    """
    logger.info("Received event: " + json.dumps(event))

    # 1. diverse Input Handling
    # Option A: Direct from Step Functions (Validator Output)
    bucket_name = event.get("bucket_name")
    
    # Option B: Direct from EventBridge (if used standalone)
    if not bucket_name:
        bucket_name = event.get("detail", {}).get("requestParameters", {}).get("bucketName")

    if not bucket_name:
        logger.error("No bucket name found. Exiting.")
        return {"status": "Failed", "reason": "No bucket name provided"}

    logger.info(f"Targeting bucket: {bucket_name}")

    # 2. Remediate
    s3 = boto3.client("s3")
    
    try:
        s3.put_public_access_block(
            Bucket=bucket_name,
            PublicAccessBlockConfiguration={
                'BlockPublicAcls': True,
                'IgnorePublicAcls': True,
                'BlockPublicPolicy': True,
                'RestrictPublicBuckets': True
            }
        )
        logger.info(f"SUCCESS: Locked down {bucket_name}")
        return {
            "status": "Success", 
            "bucket_name": bucket_name, 
            "action": "BlockPublicAccess"
        }

    except Exception as e:
        logger.error(f"Failed to remediate: {str(e)}")
        raise e