# Cloud-Audit-Zero (Auditing at zero cost) 🛡️☁️

**An Event-Driven, Serverless Cloud Security Platform for AWS.**

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Terraform](https://img.shields.io/badge/Terraform-1.5+-purple) ![AWS](https://img.shields.io/badge/AWS-Free_Tier-orange)

## 📖 Overview
**Cloud-Audit-Zero** is a "Zero Cost" security orchestration tool designed to detect and remediate misconfigurations in AWS environments in real-time. It acts as a miniature **Security Operations Center (SOC)**, utilizing an Event-Driven Architecture (EDA) to monitor infrastructure changes and enforce compliance automatically.

Unlike basic scripts, this project uses **AWS Step Functions** to orchestrate a "Detect -> Validate -> Remediate -> Log" workflow, ensuring no false positives and providing a full audit trail.

---

## 🏗️ Architecture
![alt text](Architecture-Diagram.png)

The system operates on a **Serverless First** principle:
1.  **Trigger:** CloudTrail captures infrastructure changes (e.g., `CreateBucket`).
2.  **Filter:** EventBridge rules route specific security events to the Orchestrator.
3.  **Orchestrator:** **AWS Step Functions** manages the logic flow.
4.  **Validator:** A Python Lambda checks if the resource is *actually* vulnerable.
5.  **Remediator:** A separate Python Lambda applies the fix (e.g., `BlockPublicAccess`).
6.  **Audit:** The action is permanently logged to **DynamoDB** for compliance.
7.  **Visualize:** A **CloudWatch Dashboard** provides a single pane of glass for metrics and health.

---

## 🛠️ Technology Stack (Free Tier Optimized)
* **IaC:** Terraform (v5.0+)
* **Orchestration:** AWS Step Functions (Standard Workflows)
* **Compute:** AWS Lambda (Python 3.9)
* **Database:** Amazon DynamoDB (Provisioned 1 RCU/WCU)
* **Event Bus:** Amazon EventBridge
* **Visibility:** Amazon CloudWatch Dashboards
* **Dev Environment:** Ona (Gitpod) / Docker

---

## 🚀 How to Deploy

### Prerequisites
* An AWS Account (Free Tier recommended)
* Terraform installed
* AWS CLI configured
* Python 3.9+

### Quick Start
1.  **Clone the Repository**
    ```bash
    git clone https://github.com/Sanaet-glitch/Cloud-Audit-Zero.git
    cd Cloud-Audit-Zero
    ```

2.  **Setup Python Environment**
    This project uses a virtual environment to manage dependencies safely.
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```

2.  **Initialize Terraform**
    ```bash
    terraform init
    ```

3.  **Deploy Infrastructure**
    ```bash
    terraform plan
    terraform apply -auto-approve
    ```

4.  **Verify It Works**
    * The deployment includes an **S3 Honeypot Bucket**.
    * Go to the AWS Console -> S3 -> Permissions.
    * Manually **Uncheck** "Block All Public Access".
    * Wait for the system to detect the change (approx. 5-15 mins due to CloudTrail latency).
    * Refresh the page to see the setting automatically reverted to **On**.
    * Check DynamoDB (`cloud-audit-zero-logs`) for the audit record.

## ✅ Advanced Verification & Cost Safety
This project includes dedicated scripts to verify functional integrity and strict cost compliance.

### 1. The "Zero Cost" Audit 💰
Run this script to scan your environment. It ensures all resources (Lambda, DynamoDB, Logs, S3, Dashboards) are configured strictly within AWS Free Tier limits.
```bash
python3 tests/cost_audit.py

---

## 🛡️ Security & Cost Safety
* **Zero Cost:** Designed to run 100% within the AWS Free Tier.
* **Safety Rails:** Includes Service Control Policies (SCPs) and Budget Alarms in the documentation.
* **Least Privilege:** All IAM roles are scoped strictly to required actions (`s3:PutBucketPublicAccessBlock`, `dynamodb:PutItem`, etc.).

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
