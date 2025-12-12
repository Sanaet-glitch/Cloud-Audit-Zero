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

### Task 1.5: Terraform Backend Bootstrap
* **Tool Used:** AWS CLI
* **Action:** Provisioned S3 bucket (`cloud-audit-zero-tfstate-[id]`) for state storage and DynamoDB table (`cloud-audit-zero-tf-lock`) for state locking.