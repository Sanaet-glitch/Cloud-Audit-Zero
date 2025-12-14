# Cloud Audit Zero

**Cloud Audit Zero** is a serverless, event-driven Cloud Security Posture Management (CSPM) platform. It provides real-time threat detection, automated remediation, and a centralized dashboard for security compliance.

## 🏗️ Architecture

The system utilizes a **Modular Monolith** approach on AWS Serverless:
* **Frontend:** React (Vite) + Tailwind CSS + TanStack Query (Single Page Application).
* **Backend:** AWS Lambda (Python 3.12) behind API Gateway HTTP API.
* **Infrastructure:** 100% Infrastructure as Code (Terraform).
* **Database:** DynamoDB (Audit Logs) & S3 (Honeypots).

## 🚀 Key Features
* **Automated Remediation:** Instantly locks down public S3 buckets via API trigger.
* **Real-time Dashboard:** Visualizes threat status and security events.
* **Zero-Cost Operation:** Built entirely on AWS Free Tier eligible services.

## 🛠️ Tech Stack
| Component | Technology |
| :--- | :--- |
| **UI** | React, TypeScript, Lucide Icons |
| **API** | AWS API Gateway (v2) |
| **Compute** | AWS Lambda (Python) |
| **IaC** | Terraform |

## 📦 Installation
1.  **Infrastructure:** `cd infrastructure && terraform apply`
2.  **Frontend:** `cd frontend && npm install && npm run dev`