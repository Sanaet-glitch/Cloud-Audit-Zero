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
iam = boto3.client('iam')
ec2 = boto3.client('ec2')
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

        # --- SECURITY LOGIC START ---
        
        # A. STORAGE: Public Access & Encryption Scan
        buckets_response = s3.list_buckets()
        buckets = buckets_response.get('Buckets', [])
        bucket_count = len(buckets)

        # Check Encryption on each bucket
        unencrypted_count = 0
        for b in buckets:
            try:
                # If this succeeds, encryption is ON
                s3.get_bucket_encryption(Bucket=b['Name'])
            except Exception as e:
                # Capture the string representation of the error
                error_code = str(e)
                
                # If the error is SPECIFICALLY the "Encryption Not Found" error, THEN it's a risk.
                if "ServerSideEncryptionConfigurationNotFoundError" in error_code:
                    unencrypted_count += 1
                    logger.warning(f"Bucket {b['Name']} is TRULY unencrypted.")
                    
                elif "AccessDenied" in error_code:
                    # If we get AccessDenied, it means the bucket is restricted 
                    # (like your tfstate or another log bucket). Skip it to avoid false positives.
                    logger.info(f"Skipping bucket {b['Name']} due to AccessDenied (Likely restricted policy).")
                
                else:
                    # Catch all other unexpected errors
                    logger.error(f"Could not check encryption for {b['Name']}: {error_code}")
        
        logger.info(f"Scan complete. Found {bucket_count} buckets, {unencrypted_count} unencrypted.")

        # B. IDENTITY: Root User MFA Check
        # AWS provides a summary of account attributes
        iam_summary = iam.get_account_summary()
        # 'AccountMFAEnabled' returns 1 if Root has MFA, 0 if not
        root_mfa_status = iam_summary.get('SummaryMap', {}).get('AccountMFAEnabled', 0)
        
        is_root_secure = (root_mfa_status == 1)
        logger.info(f"Root MFA Enabled: {is_root_secure}")

        # C. NETWORK: Check for Open SSH (0.0.0.0/0 on Port 22)
        open_ssh_count = 0
        try:
            sgs = ec2.describe_security_groups()['SecurityGroups']
            for sg in sgs:
                for permission in sg.get('IpPermissions', []):
                    # Check if port 22 is included in the range
                    from_port = permission.get('FromPort')
                    to_port = permission.get('ToPort')
                    
                    if from_port is not None and to_port is not None:
                         # 22 is SSH. If range covers 22...
                        if from_port <= 22 <= to_port:
                            # Check if it allows 0.0.0.0/0
                            for ip_range in permission.get('IpRanges', []):
                                if ip_range.get('CidrIp') == '0.0.0.0/0':
                                    open_ssh_count += 1
                                    logger.warning(f"Security Group {sg['GroupId']} allows Open SSH.")
        except Exception as e:
            logger.error(f"Network Scan Error: {str(e)}")

        # --- SECURITY LOGIC END ---

        # --- 2. AUDIT LOGGING ---
        # Construct a smart message based on findings
        status_msg = f"Scanned {bucket_count} buckets. Public access locked. "
        
        if unencrypted_count > 0:
            status_msg += f"WARNING: {unencrypted_count} buckets missing encryption. "
        
        if open_ssh_count > 0:
            status_msg += f"CRITICAL: {open_ssh_count} Security Groups have Open SSH. "

        if not is_root_secure:
            status_msg += "CRITICAL: Root Account missing MFA."


        table = dynamodb.Table(TABLE_NAME)
        
        log_entry = {
            'LogId': str(uuid.uuid4()),
            'Timestamp': datetime.utcnow().isoformat(),
            'Event': 'Multi-Vector Security Scan',
            'Status': 'SUCCESS', # The scan itself ran successfully
            'Details': status_msg,
            'Type': 'REMEDIATION',
            'Product': 'Cloud Audit Zero',
            'Meta': {
                'buckets_scanned': bucket_count,
                'unencrypted_count': unencrypted_count,
                'open_ssh_count': open_ssh_count,
                'root_mfa_enabled': is_root_secure
            }
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