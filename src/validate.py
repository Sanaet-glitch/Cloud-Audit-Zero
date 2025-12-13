import boto3
import json
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Validator: Checks if a bucket is truly non-compliant.
    Input: {"bucket_name": "example-bucket"} from Step Functions.
    Output: {"is_public": True/False, "bucket_name": "..."}
    """
    # 1. Get the bucket name from the event input
    # Handle both Step Functions input and direct EventBridge invocation
    if "detail" in event:
        bucket_name = event.get("detail", {}).get("requestParameters", {}).get("bucketName")
    else:
        bucket_name = event.get("bucket_name")
    
    # Fallback if parsing fails
    if not bucket_name:
         # Try looking deeper if it is wrapped in a "detail" object inside input
         bucket_name = event.get("input", {}).get("detail", {}).get("requestParameters", {}).get("bucketName")

    if not bucket_name:
        logger.error("Could not find bucket_name in event")
        return {"is_public": False, "error": "No bucket name found"}

    s3 = boto3.client("s3")
    
    logger.info(f"Validating configuration for: {bucket_name}")
    
    try:
        # 2. Check Public Access Block
        pab = s3.get_public_access_block(Bucket=bucket_name)
        conf = pab.get('PublicAccessBlockConfiguration', {})
        
        # 3. Validation Logic: If ANY setting is false, we consider it "Exposed"
        if not (conf.get('BlockPublicAcls') and conf.get('IgnorePublicAcls') and 
                conf.get('BlockPublicPolicy') and conf.get('RestrictPublicBuckets')):
            logger.warning(f"Bucket {bucket_name} has weakened Public Access Blocks.")
            return {"is_public": True, "bucket_name": bucket_name}
            
        logger.info(f"Bucket {bucket_name} is secure.")
        return {"is_public": False, "bucket_name": bucket_name}

    except ClientError as e:
        # Check if the error code is exactly what we are looking for
        if e.response['Error']['Code'] == 'NoSuchPublicAccessBlockConfiguration':
            logger.warning(f"Bucket {bucket_name} has NO Public Access Block configuration.")
            return {"is_public": True, "bucket_name": bucket_name}
        else:
            # If it's some other error (like AccessDenied), log it
            logger.error(f"AWS Error: {e}")
            return {"is_public": False, "bucket_name": bucket_name, "error": str(e)}
        
    except Exception as e:
        logger.error(f"General error: {str(e)}")
        return {"is_public": False, "bucket_name": bucket_name, "error": str(e)}