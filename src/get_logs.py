import json
import boto3
import logging
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = "CloudAuditZeroLogs"

# Helper to convert DynamoDB JSON format to standard JSON
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def lambda_handler(event, context):
    table = dynamodb.Table(TABLE_NAME)

    try:
        # Scan the table (In production, Query is better, but Scan is fine for <1MB free tier)
        response = table.scan(Limit=20)
        items = response.get('Items', [])

        # Sort by Timestamp descending (newest first)
        items.sort(key=lambda x: x.get('Timestamp', ''), reverse=True)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", # Required for CORS
                "Access-Control-Allow-Methods": "GET"
            },
            "body": json.dumps({
                "success": True,
                "data": items
            }, cls=DecimalEncoder)
        }

    except Exception as e:
        logger.error(f"Error fetching logs: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({"success": False, "message": str(e)})
        }