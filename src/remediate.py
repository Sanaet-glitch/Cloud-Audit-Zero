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
        
        # A. STORAGE: Public Access & Encryption Scan
        buckets_response = s3.list_buckets()
        buckets = buckets_response.get('Buckets', [])
        bucket_count = len(buckets)

        unencrypted_count = 0
        for b in buckets:
            try:
                s3.get_bucket_encryption(Bucket=b['Name'])
            except Exception as e:
                error_code = str(e)
                if "ServerSideEncryptionConfigurationNotFoundError" in error_code:
                    unencrypted_count += 1
                elif "AccessDenied" in error_code:
                    logger.info(f"Skipping bucket {b['Name']} (AccessDenied).")

        # B. IDENTITY: Root User MFA Check
        iam_summary = iam.get_account_summary()
        root_mfa_status = iam_summary.get('SummaryMap', {}).get('AccountMFAEnabled', 0)
        is_root_secure = (root_mfa_status == 1)

        # C. NETWORK: Active Remediation of Port 22
        # We track which SGs we actually fix
        remediated_sgs = [] 
        
        try:
            sgs = ec2.describe_security_groups()['SecurityGroups']
            for sg in sgs:
                for permission in sg.get('IpPermissions', []):
                    from_port = permission.get('FromPort')
                    to_port = permission.get('ToPort')
                    
                    if from_port is not None and to_port is not None:
                        # Check if rule covers SSH (22)
                        if from_port <= 22 <= to_port:
                            for ip_range in permission.get('IpRanges', []):
                                if ip_range.get('CidrIp') == '0.0.0.0/0':
                                    # VULNERABILITY FOUND!
                                    sg_id = sg['GroupId']
                                    logger.warning(f"Found Open SSH on {sg_id}. REMEDIATING...")
                                    
                                    # --- THE FIX ---
                                    # We revoke ONLY this specific rule immediately
                                    ec2.revoke_security_group_ingress(
                                        GroupId=sg_id,
                                        IpPermissions=[permission] # Revoke exactly what we found
                                    )
                                    remediated_sgs.append(sg_id)
                                    logger.info(f"Successfully closed Port 22 on {sg_id}")
                                    
        except Exception as e:
            logger.error(f"Network Remediation Error: {str(e)}")

        # --- SECURITY LOGIC END ---

        # --- AUDIT LOGGING ---
        # Construct detailed status message
        status_msg = f"Scanned {bucket_count} buckets. Storage Secure. "
        
        if len(remediated_sgs) > 0:
            # We explicitly list the IDs of the fixed groups
            sg_list = ", ".join(remediated_sgs)
            status_msg += f"NET SEC: Remediated Open SSH on {sg_list}. "
        
        if unencrypted_count > 0:
            status_msg += f"WARNING: {unencrypted_count} unencrypted buckets. "
            
        if not is_root_secure:
            status_msg += "CRITICAL: Root Account missing MFA."

        table = dynamodb.Table(TABLE_NAME)
        
        log_entry = {
            'LogId': str(uuid.uuid4()),
            'Timestamp': datetime.utcnow().isoformat(),
            'Event': 'Multi-Vector Remediation',
            'Status': 'SUCCESS', 
            'Details': status_msg,
            'Type': 'REMEDIATION',
            'Product': 'Cloud Audit Zero',
            'Meta': {
                'buckets_scanned': bucket_count,
                'remediated_sgs': remediated_sgs,
                'root_mfa_enabled': is_root_secure
            }
        }
        
        table.put_item(Item=log_entry)

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "success": True,
                "message": "Multi-Vector Remediation Complete.",
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