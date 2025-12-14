import boto3
import sys

def check_real_usage():
    print("💰 CONNECTING TO AWS BILLING (FREE TIER API)...")
    
    # The 'freetier' client is special and requires us-east-1
    client = boto3.client('freetier', region_name='us-east-1')
    
    try:
        response = client.get_free_tier_usage()
        usages = response['freeTierUsages']
        
        print(f"\n{'SERVICE':<30} {'USAGE TYPE':<40} {'USED / LIMIT':<25} {'STATUS'}")
        print("-" * 110)
        
        has_warnings = False
        count = 0
        
        for u in usages:
            service = u.get('service', 'Unknown')
            usage_type = u.get('usageType', 'Unknown')
            actual = u.get('actualUsageAmount', 0.0)
            limit = u.get('limit', 0.0)
            unit = u.get('unit', 'units')
            
            # Calculate percentage
            percent = (actual / limit) * 100 if limit > 0 else 0
            
            # Formatting
            usage_str = f"{actual:.2f} / {limit} {unit}"
            
            if percent >= 85:
                status = "⚠️ DANGER (>85%)"
                has_warnings = True
            elif percent > 0:
                status = f"✅ OK ({percent:.1f}%)"
            else:
                status = "🟢 ZERO (Safe)"
                
            # FORCE PRINT everything relevant to our stack, even if 0 usage
            # We filter for common services to avoid spamming 100+ irrelevant rows
            relevant_services = ["AWS Lambda", "Amazon CloudWatch", "Amazon S3", "Amazon DynamoDB", "AWS Step Functions"]
            
            if actual > 0 or any(s in service for s in relevant_services):
                print(f"{service:<30} {usage_type:<40} {usage_str:<25} {status}")
                count += 1

        print("-" * 110)
        
        if count == 0:
            print("ℹ️  NOTE: AWS Billing data updates every 24 hours. If this list is empty,")
            print("    it means your account is too new to have generated a billing report yet.")
        
        if has_warnings:
            print("\n🚨 WARNING: You are approaching a Free Tier limit!")
            sys.exit(1)
        else:
            print("\n🎉 VERIFIED: No limits exceeded.")
            sys.exit(0)

    except client.exceptions.InternalServerException:
        print("❌ AWS Error: Internal Server Error. Try again later.")
    except Exception as e:
        print("\n❌ ACCESS DENIED OR API ERROR")
        print(f"Error details: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_real_usage()