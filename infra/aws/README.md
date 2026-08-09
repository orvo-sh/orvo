# AWS production infrastructure

OpenTofu manages Orvo's production infrastructure in AWS `eu-central-1` (Frankfurt).

## Layout

- `bootstrap/` creates the private, encrypted, versioned S3 state bucket.
- `production/` creates the application, PostgreSQL, and ClickHouse EC2 instances, the application Elastic IP, encrypted database volumes, private S3 backups, security groups, IAM roles, Systems Manager access, and daily EBS snapshots.

The database ports are reachable only from the application security group. PostgreSQL and ClickHouse SSH are restricted to the `admin_cidr` supplied at apply time. The application host accepts key-based SSH from deployment runners; password authentication remains disabled by the Ubuntu image. All three hosts use the default VPC and default public subnet, matching the normal EC2 console defaults; only the application host has a stable Elastic IP intended for DNS.

## Apply

Use the `orvo-admin` AWS CLI profile and OpenTofu 1.12 or newer.

```sh
tofu -chdir=infra/aws/bootstrap init
tofu -chdir=infra/aws/bootstrap apply

tofu -chdir=infra/aws/production init
tofu -chdir=infra/aws/production plan \
  -var='admin_cidr=203.0.113.10/32' \
  -out=production.tfplan
tofu -chdir=infra/aws/production apply production.tfplan
```

Replace the example CIDR with the administrator's current public IP. Never commit plan files, state, or `.tfvars` containing secrets.

## Backups

PostgreSQL and ClickHouse create nightly logical backups in the private S3 bucket. S3 retains current objects for 35 days and old object versions for 7 days. AWS Data Lifecycle Manager also takes daily snapshots of both encrypted data volumes and retains the latest 7 snapshots.

The backup services log structured success messages to the system journal. Run them manually when validating a deployment:

```sh
sudo systemctl start orvo-postgres-backup.service
sudo systemctl start orvo-clickhouse-backup.service
```

The database data volumes and backup bucket have OpenTofu deletion protection. Removing them requires an explicit code change.
