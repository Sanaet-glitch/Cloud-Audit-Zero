import boto3
import json
import logging

# Setup simple logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Triggered by EventBridge when an S3 Bucket creation or modification event occurs.
    """
    # 1. Log the incoming event for debugging
    logger.info("Received event: " + json.dumps(event))

    # 2. Extract the bucket name from the CloudTrail event
    # The structure depends on the event type, but usually it's here:
    try:
        detail = event.get("detail", {})
        request_parameters = detail.get("requestParameters", {})
        bucket_name = request_parameters.get("bucketName")
        
        if not bucket_name:
            logger.warning("No bucket name found in event parameters.")
            return

        logger.info(f"Detected change in bucket: {bucket_name}")

        # 3. Remediate: Force Block Public Access
        s3 = boto3.client("s3")
        
        logger.info(f"Applying Public Access Block to {bucket_name}...")
        
        response = s3.put_public_access_block(
            Bucket=bucket_name,
            PublicAccessBlockConfiguration={
                'BlockPublicAcls': True,
                'IgnorePublicAcls': True,
                'BlockPublicPolicy': True,
                'RestrictPublicBuckets': True
            }
        )
        
        logger.info(f"SUCCESS: Remediation applied to {bucket_name}.")
        return response

    except Exception as e:
        logger.error(f"Error remediating bucket: {str(e)}")
        raise e