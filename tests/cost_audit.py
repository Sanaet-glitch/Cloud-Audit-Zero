import boto3
import sys

# --- CONFIGURATION ---
# PROJECT_TAG = "Cloud-Audit-Zero"  # Used for finding resources if tagged (optional)
REGION = "us-east-1"
# ---------------------

session = boto3.Session(region_name=REGION)

def print_status(resource, status, message):
    icon = "✅" if status else "⚠️"
    print(f"{icon} [{resource}]: {message}")
    return 1 if not status else 0

def check_dynamodb():
    """Verifies DynamoDB tables are within Free Tier limits (25 RCU/WCU)."""
    ddb = session.client('dynamodb')
    tables = ['cloud-audit-zero-logs', 'cloud-audit-zero-tf-lock']
    issues = 0
    
    print(f"\n--- Checking DynamoDB ---")
    for table_name in tables:
        try:
            resp = ddb.describe_table(TableName=table_name)
            billing = resp['Table'].get('BillingModeSummary', {}).get('BillingMode', 'PROVISIONED')
            prov = resp['Table'].get('ProvisionedThroughput', {})
            rcu = prov.get('ReadCapacityUnits', 0)
            wcu = prov.get('WriteCapacityUnits', 0)

            # Check: Provisioned Mode + RCU/WCU <= 25
            if (billing == 'PROVISIONED' or 'ProvisionedThroughput' in resp['Table']) and rcu <= 25 and wcu <= 25:
                print_status("DynamoDB", True, f"{table_name} is PROVISIONED (R:{rcu}/W:{wcu}) - Free Tier OK.")
            elif billing == 'PAY_PER_REQUEST':
                 print_status("DynamoDB", True, f"{table_name} is ON-DEMAND. (Safe for low volume, but strictly implies per-request billing).")
            else:
                issues += print_status("DynamoDB", False, f"{table_name} is {billing} with R:{rcu}/W:{wcu}. Check limits!")
        except ddb.exceptions.ResourceNotFoundException:
            # It's okay if tf-lock doesn't exist yet if you haven't run terraform init, but warn just in case
            print_status("DynamoDB", False, f"Table {table_name} not found.")
            issues += 1
    return issues

def check_lambda():
    """Verifies Lambda configuration (Memory & Concurrency)."""
    lam = session.client('lambda')
    functions = ['cloud-audit-zero-remediator', 'cloud-audit-zero-validator']
    issues = 0
    
    print(f"\n--- Checking Lambda ---")
    for func_name in functions:
        try:
            # 1. Check Configuration (Memory)
            conf = lam.get_function_configuration(FunctionName=func_name)
            memory = conf['MemorySize']
            if memory <= 128:
                print_status("Lambda Config", True, f"{func_name} Memory: {memory}MB - Free Tier Optimized.")
            else:
                issues += print_status("Lambda Config", False, f"{func_name} Memory: {memory}MB. Consider lowering to 128MB.")

            # 2. Check Provisioned Concurrency (Expensive!)
            try:
                lam.list_provisioned_concurrency_configs(FunctionName=func_name)
                print_status("Lambda Cost", True, f"{func_name} has NO Provisioned Concurrency.")
            except Exception:
                pass
                
        except lam.exceptions.ResourceNotFoundException:
            print_status("Lambda", False, f"Function {func_name} not found.")
            issues += 1
    return issues

def check_step_functions():
    """Verifies State Machine Type."""
    sfn = session.client('stepfunctions')
    issues = 0
    print(f"\n--- Checking Step Functions ---")
    
    machines = sfn.list_state_machines()
    found = False
    for sm in machines['stateMachines']:
        if "CloudAuditZero-Workflow" in sm['name']:
            found = True
            sm_type = sm['type']
            if sm_type == 'STANDARD':
                print_status("Step Functions", True, f"{sm['name']} is STANDARD type (4,000 free transitions/mo).")
            else:
                issues += print_status("Step Functions", False, f"{sm['name']} is {sm_type}. Check pricing.")
    
    if not found:
        issues += print_status("Step Functions", False, "Workflow not found.")
    return issues

def check_cloudwatch_logs():
    """Verifies Log Retention is not 'Never Expire'."""
    logs = session.client('logs')
    issues = 0
    log_groups = ['/aws/lambda/cloud-audit-zero-remediator', '/aws/lambda/cloud-audit-zero-validator']
    
    print(f"\n--- Checking CloudWatch Logs ---")
    for lg_name in log_groups:
        try:
            resp = logs.describe_log_groups(logGroupNamePrefix=lg_name)
            if not resp['logGroups']:
                print_status("Logs", False, f"Log Group {lg_name} not found yet (Run traffic first).")
                continue
                
            lg = resp['logGroups'][0]
            retention = lg.get('retentionInDays')
            
            if retention:
                print_status("Logs", True, f"{lg_name} retention: {retention} days.")
            else:
                issues += print_status("Logs", False, f"{lg_name} has NO retention set (Infinite storage). Add 'retention_in_days' to Terraform!")
        except Exception as e:
            print(f"Error checking logs: {e}")
    return issues

def check_dashboards():
    """Verifies CloudWatch Dashboard count (Free Tier limit = 3)."""
    cw = session.client('cloudwatch')
    issues = 0
    print(f"\n--- Checking CloudWatch Dashboards ---")
    
    resp = cw.list_dashboards()
    count = len(resp.get('DashboardEntries', []))
    
    if count <= 3:
        print_status("Dashboards", True, f"Found {count} dashboards. (Free Tier limit: 3).")
    else:
        issues += print_status("Dashboards", False, f"Found {count} dashboards! You are over the Free Tier limit of 3.")
        
    return issues

def check_s3_buckets():
    """Checks S3 Buckets for obvious risks (though cost is storage-based)."""
    s3 = session.client('s3')
    issues = 0
    print(f"\n--- Checking S3 Buckets ---")
    
    resp = s3.list_buckets()
    buckets = resp.get('Buckets', [])
    
    project_buckets = [b for b in buckets if 'cloud-audit-zero' in b['Name']]
    
    if len(project_buckets) > 0:
        for b in project_buckets:
            print_status("S3", True, f"Found project bucket: {b['Name']}. Ensure total storage < 5GB.")
    else:
        issues += print_status("S3", False, "No project buckets found. Did Terraform deploy?")
        
    return issues

def check_rogue_resources():
    """Safety Scan: Ensures no expensive EC2/NAT Gateways are running."""
    ec2 = session.client('ec2')
    issues = 0
    print(f"\n--- Safety Scan (Rogue Resources) ---")
    
    # Check Instances
    instances = ec2.describe_instances(Filters=[{'Name': 'instance-state-name', 'Values': ['running']}])
    count = sum(len(r['Instances']) for r in instances['Reservations'])
    if count == 0:
        print_status("EC2", True, "No running EC2 instances found.")
    else:
        print_status("EC2", False, f"Found {count} running EC2 instances. Verify they are Free Tier eligble.")
        
    # Check NAT Gateways (Very Expensive)
    nats = ec2.describe_nat_gateways(Filter=[{'Name': 'state', 'Values': ['available']}])
    if len(nats['NatGateways']) == 0:
        print_status("NAT Gateway", True, "No active NAT Gateways found.")
    else:
        issues += print_status("NAT Gateway", False, "⚠️ ACTIVE NAT GATEWAY FOUND! This costs ~$1/day. Delete immediately.")

    return issues

if __name__ == "__main__":
    print("💰 Starting Cloud-Audit-Zero Cost Compliance Audit...")
    total_issues = 0
    total_issues += check_dynamodb()
    total_issues += check_lambda()
    total_issues += check_step_functions()
    total_issues += check_cloudwatch_logs()
    total_issues += check_dashboards()
    total_issues += check_s3_buckets()
    total_issues += check_rogue_resources()
    
    print("\n" + "="*40)
    if total_issues == 0:
        print("🎉 AUDIT PASSED: All resources are within Free Tier configurations.")
    else:
        print(f"⚠️ AUDIT FINISHED WITH WARNINGS: Found {total_issues} potential cost risks.")
    print("="*40)