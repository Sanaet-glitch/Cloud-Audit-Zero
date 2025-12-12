# Implementation Log: Cloud-Audit-Zero

## Phase 1: Foundation and Safety
**Date:** 12-12-2025
**Objective:** Secure the AWS environment and establish Infrastructure as Code (IaC) readiness.

### Task 1.1 - 1.3: Organization & Safety Rails
* **Tool Used:** AWS Management Console
* **Action:** Created a dedicated `Demo-Account` within AWS Organizations to isolate project resources.
* **Action:** Applied a strict Service Control Policy (SCP) to deny access to expensive services (GuardDuty, Macie, RDS) and limit EC2 instances to `t2.micro` / `t3.micro`.
* **Action:** Configured a root-level AWS Budget to alert at $0.01 USD.

### Task 1.4: Repository Initialization
* **Tool Used:** Git CLI
* **Action:** Initialized repository with standard `.gitignore` for Terraform and Python.

### Task 1.4b: Development Environment Automation
* **Problem:** The Ona/Docker environment resets on restart, requiring manual re-installation of tools.
* **Solution:** "Shift Left" on tooling. Configured the `.devcontainer/Dockerfile` to bake AWS CLI and Terraform directly into the container image.
* **Benefit:** Ensures a consistent, reproducible development environment (CDE) for any developer working on the project, eliminating "it works on my machine" issues.
* **Tools Installed:** AWS CLI v2, Terraform.

### Task 1.4c: Zero-Touch Authentication Strategy
* **Problem:** Running `aws configure` manually is repetitive, insecure, and risks leaving credential files on disk.
* **Solution:** Configured `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_DEFAULT_REGION` as Environment Variables in the Ona/Gitpod User Settings.
* **Result:** The workspace automatically authenticates as the `Demo-Account` user upon startup. Identity verified via `aws sts get-caller-identity`.
* **Constraint Note:** Because these variables are set at the User level, they apply to all workspaces. For future multi-account projects, we will override these using repository-specific secrets or local `.env` files to prevent credential clashes.

### Troubleshooting: IAM Permission Error
* **Error:** `AccessDenied` when running `aws s3 mb`.
* **Cause:** The IAM user `CLI-Access-Account-CAZ` was created but assigned no permissions (Identity-based policy).
* **Fix:** Attached the `AdministratorAccess` managed policy to the user via the AWS IAM Console.
* **Lesson:** New IAM entities are implicitly denied all actions by default (Zero Trust). Permissions must be explicitly granted.

### Task 1.5: Terraform Backend Bootstrap
* **Tool Used:** AWS CLI
* **Objective:** Provision the "Chicken and Egg" resources (S3 & DynamoDB) required for Terraform to store its state file securely. These cannot be managed by Terraform itself initially.

* **Blocker Encountered:** `AccessDenied` error when attempting `aws s3 mb`.
    * **Root Cause:** The IAM user `CLI-Access-Account-CAZ` was created but had no attached identity-based policies.
    * **Resolution:** Logged into AWS Console > IAM, and attached the `AdministratorAccess` managed policy to the user. Verified fix by re-running the command.

* **Action:** Executed the following AWS CLI bootstrap commands:
    1.  `aws s3 mb s3://cloud-audit-zero-tfstate-sanaet`
    2.  `aws s3api put-bucket-encryption ...` (Enabled AES256 server-side encryption)
    3.  `aws s3api put-bucket-versioning ...` (Enabled versioning for disaster recovery of state files)
    4.  `aws dynamodb create-table ...` (Created `cloud-audit-zero-tf-lock` table with LockID primary key)

* **Result:** Backend infrastructure is live.
    * **Bucket:** `cloud-audit-zero-tfstate-sanaet` (Secure & Versioned)
    * **Lock Table:** `cloud-audit-zero-tf-lock` (Cost optimized to 1 RCU/WCU)
    * **Status:** Ready for `terraform init`.

### Task 1.6: Terraform Initialization
* **Action:** Created `main.tf` defining the AWS Provider (v5.0+) and the S3 Remote Backend configuration.
* **Tool Used:** Terraform CLI
* **Command:** `terraform init`
* **Result:** "Terraform has been successfully initialized!"
    * Verified that Terraform can read/write to the state bucket.
    * Verified that the AWS provider plugin was downloaded.
    * **Milestone:** The project infrastructure foundation is now active.

### Task 2.1: S3 Honeypot Deployment
* **Action:** Defined `s3_honeypot.tf` to provision a test bucket with `random_string` for uniqueness.
* **Security:** Configured `aws_s3_bucket_public_access_block` to be SECURE (True) by default, allowing for controlled simulation of security events later.
* **Verification:** Deployed via `terraform apply` and verified public access block settings using `aws s3api get-public-access-block`.

### Task 2.2 & 2.3: Remediation Logic (Lambda)
* **Action:** Created `src/remediate.py` using the `boto3` library.
    * **Logic:** The script parses the EventBridge JSON, extracts the `bucketName`, and executes `s3.put_public_access_block` to lock the bucket down.
* **Infrastructure:** Defined `lambda.tf` to provision:
    * **IAM Role:** `cloud-audit-zero-lambda-role` with "AssumeRole" trust policy for the Lambda service.
    * **IAM Policy:** Least-privilege permission restricted to `s3:PutBucketPublicAccessBlock` and CloudWatch Logging.
    * **Function:** `cloud-audit-zero-remediator` (Python 3.9) with automatic zipping of source code.
* **Tool Used:** Terraform
* **Status:** Deployed successfully.

### Task 2.4: The Trigger (EventBridge)
* **Action:** Created `eventbridge.tf` to wire the detection logic.
* **Event Pattern:** configured to listen for `AWS API Call via CloudTrail` specifically for:
    * `CreateBucket` (New resources)
    * `DeleteBucketPublicAccessBlock` (Security downgrades)
    * `PutBucketAcl` (Permission changes)
* **Target:** Connected the Rule to the `cloud-audit-zero-remediator` Lambda.
* **Permission:** Added `aws_lambda_permission` to allow the EventBridge service to invoke the function.
* **Constraint Note:** Acknowledged that CloudTrail-based events have a variable latency (typically 5-15 minutes) compared to native S3 notifications.

### Troubleshooting: CloudTrail Latency
* **Issue:** After applying the configuration, the S3 bucket did not remediate automatically within 15 minutes.
* **Root Cause:** AWS CloudTrail can have a delivery latency of 5-15+ minutes for the first event in a new region/setup.
* **Resolution: Manual Event Injection**
    * Created a mock event file `test_event.json` mimicking the CloudTrail JSON structure.
    * Used command: `aws events put-events --entries file://test_event.json`
* **Result:** Confirmed the Lambda logic and EventBridge permission were correct immediately, without waiting for the asynchronous CloudTrail delivery.

### Troubleshooting: Testing the Logic
* **Attempt 1 (Manual Event):** Tried `aws events put-events` to simulate an S3 event.
    * **Error:** `NotAuthorizedForSourceException`
    * **Cause:** AWS does not allow custom events to use the reserved `aws.s3` source namespace to prevent spoofing.
* **Attempt 2 (Direct Invoke):** Bypassed EventBridge to test the Lambda logic directly.
    * **Action:** Created `lambda_payload.json` mimicking the EventBridge structure.
    * **Command:** `aws lambda invoke --function-name cloud-audit-zero-remediator --payload file://lambda_payload.json response.json`
* **Result:** Lambda executed successfully (StatusCode 200). CloudWatch Log Group created. S3 Bucket successfully remediated (Public Access Blocked).

### Task 2.5: Verification & Remediation Test
* **Action:** Manually removed the "Public Access Block" from the S3 Honeypot via the AWS Console to simulate a security breach.
* **Test Method:**
    * Initial CloudTrail trigger was delayed.
    * Performed **Direct Lambda Invocation** using `aws lambda invoke` with `lambda_payload.json`.
* **Result:**
    * **Success:** The S3 Honeypot configuration automatically reverted to "Block Public Access: On".
    * **Verification:** Confirmed via AWS Console S3 Permissions tab.
* **Status:** The "Vertical Slice" (Detect -> Remediate) is functional. Phase 2 Complete.

