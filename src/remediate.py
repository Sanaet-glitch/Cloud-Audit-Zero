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

TABLE_NAME = "CloudAuditZeroLogs"

def lambda_handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")
    
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

    try:
        # --- SECURITY LOGIC START ---
        
        # A. STORAGE: Detailed Scan
        buckets_response = s3.list_buckets()
        buckets = buckets_response.get('Buckets', [])
        bucket_names = [b['Name'] for b in buckets]
        bucket_count = len(buckets)

        unencrypted_buckets = []
        for b in buckets:
            try:
                s3.get_bucket_encryption(Bucket=b['Name'])
            except Exception as e:
                error_code = str(e)
                if "ServerSideEncryptionConfigurationNotFoundError" in error_code:
                    unencrypted_buckets.append(b['Name'])
                elif "AccessDenied" in error_code:
                    logger.info(f"Skipping bucket {b['Name']} (AccessDenied).")

        # B. IDENTITY: Root User MFA Check
        iam_summary = iam.get_account_summary()
        root_mfa_status = iam_summary.get('SummaryMap', {}).get('AccountMFAEnabled', 0)
        is_root_secure = (root_mfa_status == 1)

        # C. NETWORK: Active Remediation with Names
        remediated_sgs = [] # Stores formatted strings like "sg-123 (WebServer)"
        
        try:
            sgs = ec2.describe_security_groups()['SecurityGroups']
            for sg in sgs:
                for permission in sg.get('IpPermissions', []):
                    from_port = permission.get('FromPort')
                    to_port = permission.get('ToPort')
                    
                    if from_port is not None and to_port is not None:
                        if from_port <= 22 <= to_port:
                            for ip_range in permission.get('IpRanges', []):
                                if ip_range.get('CidrIp') == '0.0.0.0/0':
                                    # VULNERABILITY FOUND!
                                    sg_id = sg['GroupId']
                                    sg_name = sg.get('GroupName', 'Unknown')
                                    
                                    # Log before fixing
                                    logger.warning(f"Found Open SSH on {sg_id} ({sg_name}). REMEDIATING...")
                                    
                                    # FIX
                                    ec2.revoke_security_group_ingress(
                                        GroupId=sg_id,
                                        IpPermissions=[permission]
                                    )
                                    
                                    # Add to report
                                    remediated_sgs.append(f"{sg_id} ({sg_name})")
                                    
        except Exception as e:
            logger.error(f"Network Remediation Error: {str(e)}")

        # --- AUDIT LOGGING (ENTERPRISE FORMAT) ---
        
        # Helper to format lists cleanly
        def format_list(items, max_show=3):
            if not items: return ""
            if len(items) <= max_show:
                return ", ".join(items)
            return f"{', '.join(items[:max_show])} and {len(items)-max_show} others"

        # Construct the detailed message
        details_parts = []
        
        # 1. Storage Part
        if bucket_count > 0:
            details_parts.append(f"Scanned: [{format_list(bucket_names)}].")
        else:
            details_parts.append("No buckets found.")

        # 2. Network Part (The Remediation)
        if remediated_sgs:
            details_parts.append(f"REMEDIATED SSH on: {', '.join(remediated_sgs)}.")
        else:
            details_parts.append("Network Secure.")

        # 3. Encryption Warnings
        if unencrypted_buckets:
            details_parts.append(f"WARNING: Unencrypted buckets detected: {format_list(unencrypted_buckets)}.")
            
        # 4. Identity Warnings
        if not is_root_secure:
            details_parts.append("CRITICAL: Root Account missing MFA.")

        # Combine
        final_msg = " ".join(details_parts)

        table = dynamodb.Table(TABLE_NAME)
        
        log_entry = {
            'LogId': str(uuid.uuid4()),
            'Timestamp': datetime.utcnow().isoformat(),
            'Event': 'Multi-Vector Remediation',
            'Status': 'SUCCESS', 
            'Details': final_msg,
            'Type': 'REMEDIATION',
            'Product': 'Cloud Audit Zero',
            'Meta': {
                'total_buckets': bucket_count,
                'fixed_sgs_count': len(remediated_sgs),
                'root_mfa': is_root_secure
            }
        }
        
        table.put_item(Item=log_entry)

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "success": True,
                "message": "Deep Scan Complete.",
                "data": log_entry
            })
        }

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({
                "success": False,
                "message": f"Internal Server Error: {str(e)}"
            })
        }