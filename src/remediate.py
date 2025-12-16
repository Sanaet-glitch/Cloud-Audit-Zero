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
rds = boto3.client('rds')
dynamodb = boto3.client('dynamodb')
dynamodb_res = boto3.resource('dynamodb')

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
        # --- 1. PARSE INPUT & MODE ---
        body = {}
        if 'body' in event:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        
        mode = body.get('action', 'scan') 
        logger.info(f"Engine Mode: {mode.upper()}")

        # ====================================================
        # PILLAR 1: DATA ENCRYPTION (S3 + DATABASES)
        # ====================================================
        
        buckets = s3.list_buckets().get('Buckets', [])
        bucket_names = [b['Name'] for b in buckets]
        bucket_count = len(buckets)
        
        unencrypted_buckets = []
        fixed_buckets = []
        
        for b_name in bucket_names:
            try:
                s3.get_bucket_encryption(Bucket=b_name)
            except Exception as e:
                if "ServerSideEncryptionConfigurationNotFoundError" in str(e):
                    if mode in ['remediate_all', 'remediate_encryption']:
                        logger.warning(f"Enabling Encryption on {b_name}...")
                        s3.put_bucket_encryption(
                            Bucket=b_name,
                            ServerSideEncryptionConfiguration={'Rules': [{'ApplyServerSideEncryptionByDefault': {'SSEAlgorithm': 'AES256'}}]}
                        )
                        fixed_buckets.append(b_name)
                    else:
                        unencrypted_buckets.append(b_name)

        # Database Checks (RDS/DynamoDB) - Scan Only
        unencrypted_rds = []
        try:
            dbs = rds.describe_db_instances()['DBInstances']
            for db in dbs:
                if not db['StorageEncrypted']:
                    unencrypted_rds.append(db['DBInstanceIdentifier'])
        except Exception as e:
            logger.error(f"RDS Scan Error: {str(e)}")

        unencrypted_dynamo = []
        try:
            tables = dynamodb.list_tables()['TableNames']
            for t_name in tables:
                desc = dynamodb.describe_table(TableName=t_name)['Table']
                if 'SSEDescription' in desc and desc['SSEDescription']['Status'] == 'DISABLED':
                    unencrypted_dynamo.append(t_name)
        except Exception as e:
            logger.error(f"DynamoDB Scan Error: {str(e)}")


        # ====================================================
        # PILLAR 2: STORAGE SECURITY (Public Access)
        # ====================================================
        public_risk_buckets = [] 
        
        for b_name in bucket_names:
            # 1. CHECK STATUS
            is_public = False
            try:
                pab = s3.get_public_access_block(Bucket=b_name)
                conf = pab['PublicAccessBlockConfiguration']
                if not (conf['BlockPublicAcls'] and conf['IgnorePublicAcls'] and conf['BlockPublicPolicy'] and conf['RestrictPublicBuckets']):
                    is_public = True
            except Exception as e:
                if "NoSuchPublicAccessBlockConfiguration" in str(e):
                    is_public = True
            
            # 2. ACT
            if is_public:
                if mode in ['remediate_all', 'remediate_storage']:
                    try:
                        s3.put_public_access_block(
                            Bucket=b_name,
                            PublicAccessBlockConfiguration={
                                'BlockPublicAcls': True, 'IgnorePublicAcls': True,
                                'BlockPublicPolicy': True, 'RestrictPublicBuckets': True
                            }
                        )
                        public_risk_buckets.append(b_name)
                    except Exception as e:
                        logger.error(f"Failed to lock bucket {b_name}: {str(e)}")
                elif mode == 'scan':
                    public_risk_buckets.append(b_name)

        # ====================================================
        # PILLAR 3: IDENTITY (IAM)
        # ====================================================
        iam_summary = iam.get_account_summary()
        root_mfa_status = iam_summary.get('SummaryMap', {}).get('AccountMFAEnabled', 0)
        is_root_secure = (root_mfa_status == 1)

        # ====================================================
        # PILLAR 4: NETWORK (EC2 Security Groups)
        # ====================================================
        open_sgs = []
        remediated_sgs = []
        
        try:
            sgs = ec2.describe_security_groups()['SecurityGroups']
            for sg in sgs:
                for perm in sg.get('IpPermissions', []):
                    # --- FIX: ROBUST "ALL TRAFFIC" DETECTION ---
                    protocol = perm.get('IpProtocol')
                    from_port = perm.get('FromPort')
                    to_port = perm.get('ToPort')
                    
                    is_risk_rule = False

                    # Condition A: Protocol is "-1" (AWS code for All Traffic)
                    if protocol == '-1':
                        is_risk_rule = True
                    
                    # Condition B: Specific Port Range includes 22 (SSH)
                    # We utilize elif here so we don't crash on None values from Condition A
                    elif from_port is not None and to_port is not None:
                        if from_port <= 22 <= to_port:
                            is_risk_rule = True
                    
                    # If either condition is met, check if it's open to the world
                    if is_risk_rule:
                        for ip in perm.get('IpRanges', []):
                            if ip.get('CidrIp') == '0.0.0.0/0':
                                # WE FOUND A RISK
                                identifier = f"{sg['GroupId']} ({sg.get('GroupName','?')})"
                                
                                if mode in ['remediate_all', 'remediate_network']:
                                    # Fix it by revoking this specific rule
                                    ec2.revoke_security_group_ingress(GroupId=sg['GroupId'], IpPermissions=[perm])
                                    remediated_sgs.append(identifier)
                                else:
                                    open_sgs.append(identifier)
        except Exception as e:
            logger.error(f"Network Scan Error: {str(e)}")

        # ====================================================
        # REPORTING
        # ====================================================
        def format_list(items): return ", ".join(items[:3]) + (f" (+{len(items)-3})" if len(items)>3 else "")

        details = []
        status_flag = 'SUCCESS'

        # 1. Encryption Report
        if unencrypted_buckets: details.append(f"WARNING: Unencrypted S3: {format_list(unencrypted_buckets)}.")
        if unencrypted_rds: details.append(f"CRITICAL: Unencrypted RDS: {format_list(unencrypted_rds)}.")
        if unencrypted_dynamo: details.append(f"WARNING: Unencrypted DynamoDB: {format_list(unencrypted_dynamo)}.")
        if fixed_buckets: details.append(f"FIXED: Encrypted {len(fixed_buckets)} Buckets.")

        # 2. Network Report
        if open_sgs: details.append(f"CRITICAL: Open Access (SSH/All) on {format_list(open_sgs)}.")
        if remediated_sgs: details.append(f"FIXED: Secured {len(remediated_sgs)} SGs.")

        # 3. Identity Report
        if not is_root_secure: details.append("CRITICAL: Root MFA Missing.")

        # 4. Storage Report
        if public_risk_buckets:
            if 'remediate' in mode:
                details.append(f"FIXED: Locked {len(public_risk_buckets)} Public Buckets.")
            else:
                details.append(f"CRITICAL: Found {len(public_risk_buckets)} Public Buckets.")

        # Overall Status Logic
        risks_exist = (unencrypted_buckets or unencrypted_rds or open_sgs or not is_root_secure or (mode == 'scan' and public_risk_buckets))
        
        if risks_exist and 'scan' in mode:
            status_flag = 'WARNING'
        
        final_msg = " ".join(details) if details else "All Systems Secure."
        if mode == 'scan': final_msg = "[SCAN] " + final_msg
        else: final_msg = f"[REMEDIATION-{mode.upper().replace('REMEDIATE_', '')}] " + final_msg

        # DynamoDB Write
        table = dynamodb_res.Table(TABLE_NAME)
        log_entry = {
            'LogId': str(uuid.uuid4()),
            'Timestamp': datetime.utcnow().isoformat(),
            'Event': 'Security Scan' if mode == 'scan' else 'Remediation',
            'Status': status_flag,
            'Details': final_msg,
            'Type': 'SCAN' if mode == 'scan' else 'REMEDIATION',
            'Product': 'Cloud Audit Zero',
            'Meta': {
                'mode': mode,
                'total_buckets': bucket_count,
                'open_buckets': public_risk_buckets if mode == 'scan' else [],
                'unencrypted_rds': len(unencrypted_rds),
                'unencrypted_dynamo': len(unencrypted_dynamo),
                'open_sgs': len(open_sgs),
                'remediated_sgs': len(remediated_sgs),
                'root_mfa_secure': is_root_secure
            }
        }
        table.put_item(Item=log_entry)

        return {"statusCode": 200, "headers": headers, "body": json.dumps({"success": True, "data": log_entry})}

    except Exception as e:
        logger.error(f"Critical Error: {str(e)}")
        return {"statusCode": 500, "headers": headers, "body": json.dumps({"success": False, "message": str(e)})}