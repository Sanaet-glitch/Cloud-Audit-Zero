import boto3
import time
import sys
import json

# --- CONFIGURATION ---
# REPLACE THIS with your actual bucket name and region from 'terraform output'
BUCKET_NAME = "cloud-audit-zero-honeypot-bu4dc8" 
REGION = "us-east-1"
# ---------------------

s3 = boto3.client("s3", region_name=REGION)
dynamodb = boto3.client("dynamodb", region_name=REGION)
sfn = boto3.client("stepfunctions", region_name=REGION)

def get_state_machine_arn():
    """Finds the ARN of our specific Step Function workflow."""
    sf_list = sfn.list_state_machines()
    for machine in sf_list['stateMachines']:
        if "CloudAuditZero-Workflow" in machine['name']:
            return machine['stateMachineArn']
    return None

def simulate_attack():
    """Simulates a user making the bucket public."""
    print(f"😈 ATTACK: Removing Public Access Block from {BUCKET_NAME}...")
    try:
        s3.delete_public_access_block(Bucket=BUCKET_NAME)
        print("✅ Attack successful: Bucket is now vulnerable.")
    except Exception as e:
        print(f"❌ Attack failed: {e}")
        sys.exit(1)

def trigger_workflow_manually():
    """
    Bypasses CloudTrail latency by triggering the Step Function directly.
    In a real 24/7 run, you would just wait 15 mins for CloudTrail.
    For this test, we force it to run immediately.
    """
    arn = get_state_machine_arn()
    if not arn:
        print("❌ Error: Could not find State Machine ARN.")
        sys.exit(1)

    print(f"⚡ TRIGGER: Manually starting Step Function execution...")
    payload = {
        "detail": {
            "requestParameters": {
                "bucketName": BUCKET_NAME
            }
        }
    }
    
    response = sfn.start_execution(
        stateMachineArn=arn,
        input=json.dumps(payload)
    )
    print(f"✅ Workflow started. Execution ARN: {response['executionArn']}")
    return response['executionArn']

def verify_remediation():
    """Checks if the bucket is secure again."""
    print("🔍 VERIFY: Checking bucket status...")
    
    # Give the Lambda a few seconds to finish
    time.sleep(5) 
    
    try:
        response = s3.get_public_access_block(Bucket=BUCKET_NAME)
        conf = response.get('PublicAccessBlockConfiguration', {})
        
        is_secure = (conf.get('BlockPublicAcls') and 
                     conf.get('IgnorePublicAcls') and 
                     conf.get('BlockPublicPolicy') and 
                     conf.get('RestrictPublicBuckets'))
        
        if is_secure:
            print("✅ SUCCESS: Bucket is SECURE (Public Access Block is ON).")
            return True
        else:
            print("❌ FAILURE: Bucket is STILL VULNERABLE.")
            return False
            
    except Exception as e:
        print(f"❌ Error checking bucket: {e}")
        return False

def verify_audit_log():
    """Checks if DynamoDB has the record."""
    print("🔍 AUDIT: Checking DynamoDB for logs...")
    try:
        # Scan is okay for this small test table
        response = dynamodb.scan(TableName="cloud-audit-zero-logs")
        items = response.get('Items', [])
        
        # Look for our bucket in the logs
        found = False
        for item in items:
            if item.get('BucketName', {}).get('S') == BUCKET_NAME:
                found = True
                break
        
        if found:
            print("✅ SUCCESS: Audit log found in DynamoDB.")
            return True
        else:
            print("❌ FAILURE: No audit log found for this bucket.")
            return False

    except Exception as e:
        print(f"❌ Error checking DynamoDB: {e}")
        return False

if __name__ == "__main__":
    print(f"--- Starting Auto-Test for {BUCKET_NAME} ---")
    
    # 1. Break it
    simulate_attack()
    
    # 2. Fix it (Force trigger to skip CloudTrail wait)
    trigger_workflow_manually()
    
    # 3. Wait a moment for execution
    print("⏳ Waiting 10 seconds for workflow to complete...")
    time.sleep(10)
    
    # 4. Check results
    remediation_pass = verify_remediation()
    audit_pass = verify_audit_log()
    
    if remediation_pass and audit_pass:
        print("\n🎉 TEST PASSED: System auto-healed and logged the incident.")
        sys.exit(0)
    else:
        print("\n💥 TEST FAILED: System did not function as expected.")
        sys.exit(1)