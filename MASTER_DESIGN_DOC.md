## Master Design Document (MDD)

#### **1.0 Executive Strategy**
**Situation (The Problem):** Aspiring cloud engineers and individual learners often struggle to practice real-world security operations because enterprise tools (like Palo Alto Prisma or AWS Security Hub) are prohibitively expensive. This creates a "skills gap" where learners cannot afford to protect their own sandbox environments.
    
- **Task (The Goal):** Build Cloud-Audit-Zero, a production-grade, serverless security platform designed specifically for education and individual use. It must detect common cloud misconfigurations and remediate them automatically.
    
- **Constraint:** The system must operate on the **AWS Free Tier** with **Zero Cost**, proving that professional-grade security does not require an enterprise budget.
    
- **Action (The Solution):** I will architect a "Serverless First" solution:
    
    - **Detection:** Event-driven architecture using AWS CloudTrail & EventBridge.
        
    - **Orchestration:** AWS Step Functions for transparent, visual workflow logic.
        
    - **Remediation:** Python Lambdas for automated fixing.
        
    - **Development:** Hosted entirely in Ona (Gitpod) to ensure accessibility for students with limited hardware.
        
- **Result (The Outcome):** A fully documented, open-source reference architecture that serves as both a functional security tool and a learning platform for DevSecOps best practices.

## 2.0 System Architecture
**2.1 Logical Data Flow** Cloud-Audit-Zero follows an Event-Driven Architecture (EDA). It utilizes a "Detect-Verify-Remediate" pattern to minimize false positives. Instead of reacting blindly to every event, the system uses an orchestration layer to validate the security posture before taking action.

**2.2 Architecture Diagram**


**2.3 Component Breakdown**

- **Trigger (CloudTrail & EventBridge):** Listens for infrastructure changes (Management Events) without incurring data logging costs.
    
- **Orchestrator (Step Functions):** Manages the workflow state. It ensures that remediation only happens _after_ validation logic confirms a threat.
    
- **Validator (Lambda - Python):** A read-only function that inspects the resource configuration (e.g., checking S3 Bucket Policies/ACLs) to confirm exposure.
    
- **Remediator (Lambda - Python):** A write-access function that applies specific security controls (e.g., `s3:put_public_access_block`) to neutralize the threat.
    
- **Audit (DynamoDB):** A persistent store for compliance logs, recording the _Who_, _What_, and _When_ of every incident.
    

**2.4 Capability Roadmap (Scope of Project)** While the initial release focuses on Storage Security, the architecture supports a modular expansion of detection capabilities:

- **Module A (Storage):** Detect & Remediate Public S3 Buckets. _[Current Phase]_
    
- **Module B (Identity):** Detect Root Account usage and inactive IAM User keys.
    
- **Module C (Compute):** Detect Security Groups exposing port 22 (SSH) to the public internet (`0.0.0.0/0`).
    
- **Module D (Logging):** Detect modifications or disabling of CloudTrail logging.

## 3.0 The Stack & Tooling

This project strictly adheres to the AWS Free Tier limitations to demonstrate cost-effective cloud security engineering. The following technologies have been selected for their "Serverless" nature, eliminating the need for always-on servers.

**3.1 Core Infrastructure**

- **Infrastructure as Code (IaC):** Terraform (v1.5+)
    
    - _Rationale:_ Industry standard for defining cloud resources; allows for rapid "destroy and recreate" cycles to save costs.
        
- **Cloud Provider:** AWS (Region: `us-east-1`)
    
    - _Constraint:_ All resources must be deployed in a single region to avoid complex networking charges.
        

**3.2 Serverless Compute & Orchestration**

- **Orchestrator:** AWS Step Functions (Standard Workflows)
    
    - _Free Tier Limit:_ 4,000 state transitions per month.
        
    - _Usage Strategy:_ I will use Standard Workflows (not Express) to visualize execution history. I will limit testing to ~50 executions per month to stay safely under the limit.
        
- **Logic Execution:** AWS Lambda (Python 3.9+)
    
    - _Free Tier Limit:_ 400,000 GB-seconds of compute time per month.
        
    - _Usage Strategy:_ Functions will be short-lived (< 5 seconds) with 128MB memory allocation to maximize free tier usage.
        

**3.3 Data & Event Management**

- **Event Bus:** Amazon EventBridge (Default Bus)
    
    - _Cost:_ Free for AWS service events (e.g., CloudTrail events).
        
- **Audit Database:** Amazon DynamoDB (On-Demand Capacity Mode)
    
    - _Free Tier Limit:_ 25 GB of storage.
        
    - _Usage Strategy:_ I will use **On-Demand** mode rather than Provisioned mode to avoid hourly costs for idle time.
        
- **Logging:** Amazon CloudWatch Logs
    
    - _Cost Control:_ Log retention will be strictly set to **1 to 3 days** to prevent storage cost accumulation.
        

**3.4 Development Environment**

- **IDE:** Ona (Gitpod) / Cloud-based VS Code
    
    - _Benefit:_ Provides a consistent, pre-configured environment with Terraform and AWS CLI pre-installed; keeps AWS credentials off personal local hardware.
        
- **Version Control:** GitHub
    
    - _Usage:_ Hosts the repository, documentation, and GitHub Actions workflows.
        

**3.5 The "Bait" (Target Resource)**

- **Target:** AWS EC2 (t2.micro or t3.micro)
    
    - _Free Tier Limit:_ 750 hours per month.
        
    - _Usage Strategy:_ Used solely to simulate a "compromised host" or "misconfigured server." Must be stopped/terminated when not actively testing.

## 4.0 Implementation Roadmap

This project will be executed in **four distinct phases**. This "phased approach" ensures we have a working product at every stage, preventing the "it works on my machine but I can't deploy it" trap.

### **Phase 1: Foundation & Safety (The "Zero Cost" Guardrails)**

**Goal:** Secure the AWS environment and establish the Infrastructure as Code (IaC) baseline.

- **Task 1.1:** Configure AWS Organization and create the `Demo-Account`.
    
- **Task 1.2:** Apply **Service Control Policies (SCPs)** to the `Demo-Account` to block expensive services (e.g., RDS, NAT Gateways, Macie).
    
- **Task 1.3:** Set up AWS Budgets ($1.00 threshold) and CloudWatch Billing Alarms in the Management Account.
    
- **Task 1.4:** Initialize the GitHub Repository with the folder structure and pre-commit hooks.
    
- **Task 1.5:** Configure Terraform backend (S3 + DynamoDB) for state locking.
    
- **Definition of Done:** `terraform plan` runs successfully on an empty state, and I receive an email alert if I try to launch a large EC2 instance.
    

### **Phase 2: The Vertical Slice (S3 Detection MVP)**

**Goal:** Prove the "Detect-Remediate" logic works for a single resource (S3) without complexity.

- **Task 2.1:** Write the "Vulnerable S3 Bucket" Terraform module (to act as the bait).
    
- **Task 2.2:** Configure CloudTrail (Management Events only) and verify logs are appearing.
    
- **Task 2.3:** specific EventBridge Rule to capture `CreateBucket`.
    
- **Task 2.4:** Write the `Remediator` Lambda (Python) to attach a "Deny Public Access" policy.
    
- **Task 2.5:** Connect EventBridge directly to Lambda (skip Step Functions for now) to test the raw logic.
    
- **Definition of Done:** I can run `terraform apply`, create a public bucket, and within 60 seconds, see it automatically turn private.
    

### **Phase 3: The Enterprise Orchestration (Step Functions)**

**Goal:** Introduce state management, validation, and logging (The "Professional" Layer).

- **Task 3.1:** Write the `Config Validator` Lambda (Python) to check if a bucket is _actually_ public (reducing false positives).
    
- **Task 3.2:** Define the AWS Step Functions State Machine (ASL) in Terraform.
    
- **Task 3.3:** Provision the DynamoDB Audit Table.
    
- **Task 3.4:** Re-wire EventBridge to trigger the Step Function instead of the Lambda.
    
- **Task 3.5:** Update Python Lambdas to write their output to the Step Function context.
    
- **Definition of Done:** A visual graph in the AWS Console shows the flow from Trigger -> Validate -> Remediate -> Log, and a record appears in DynamoDB.
    

### **Phase 4: Documentation & Polish**

**Goal:** Make the project portfolio-ready and interview-proof.

- **Task 4.1:** Finalize `README.md` with the "How to Run" guide.
    
- **Task 4.2:** Create the `03_implementation_log.md` with screenshots of the Step Functions graph and successful remediation.
    
- **Task 4.3:** Record a short (2-minute) demo video or GIF of the remediation in action.
    
- **Task 4.4:** (Optional) Build a simple React static dashboard hosted on S3 to view the DynamoDB logs.
    
- **Definition of Done:** The GitHub repository is public, clean, and allows anyone to understand the project in under 30 seconds.