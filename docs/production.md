# Production operations

Orvo runs in AWS `eu-central-1` (Frankfurt). The application repository owns the app and ingest containers, while PostgreSQL and ClickHouse are independent backing services. Infrastructure changes are performed explicitly in AWS and are not coupled to application releases.

## Runtime layout

| Role | AWS name | Size | Persistent storage |
| --- | --- | --- | --- |
| App and ingest | `orvo-prod-app` | `t4g.small` | Container host only |
| PostgreSQL | `orvo-prod-postgres` | `t4g.small` | 32 GiB encrypted EBS |
| ClickHouse | `orvo-prod-clickhouse` | `t4g.medium` | 64 GiB encrypted EBS |

The app host has the Elastic IP `3.74.10.254`. Database ports are restricted to the app host's security group. Do not publish the database ports or use database public addresses in application configuration.

The local SSH aliases are:

```sh
ssh orvo-prod-app
ssh orvo-prod-postgres
ssh orvo-prod-clickhouse
```

Use AWS tags instead of copying instance IDs into scripts:

```sh
aws --profile orvo-admin --region eu-central-1 ec2 describe-instances \
  --filters Name=tag:Project,Values=orvo Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].{Name:Tags[?Key==`Name`]|[0].Value,Id:InstanceId,PrivateIp:PrivateIpAddress,Type:InstanceType}' \
  --output table
```

## Application deployment

Pushing to `main` runs `.github/workflows/deploy-prod.yml`. The workflow builds ARM64 images, pushes them to GitHub Container Registry, runs both database migrations, deploys ingest and app with Kamal, and verifies their health endpoints.

Required GitHub Actions secrets include the app host, SSH key, database URLs, PostgreSQL CA certificate, and application provider credentials. Database URLs must use the database hosts' private IP addresses. Never commit their values.

The deployed endpoints are:

- `https://app.orvo.sh` with health check `/health`
- `https://ingest.orvo.sh` with readiness check `/ready`

Both DNS records should resolve to `3.74.10.254`. Kamal Proxy terminates TLS on the app host and routes each hostname to its container.

For a manual release from a prepared workstation, populate `.kamal/secrets` and the `KAMAL_*` environment variables expected by the deployment configs, then run:

```sh
kamal deploy -c config/deploy.ingest.yml
kamal deploy -c config/deploy.app.yml
```

## Database backups

The private, encrypted, versioned bucket `orvo-production-backups-518902362990-eu-central-1` stores logical backups. Current objects expire after 35 days and noncurrent versions after 7 days.

PostgreSQL creates a custom-format `pg_dump` every night at 02:15 UTC. ClickHouse creates a native database backup every night at 02:45 UTC. Both timers include a randomized delay of up to ten minutes.

AWS Data Lifecycle Manager policy `policy-04ce577915cb524db` also takes daily snapshots of the two database data volumes and retains seven snapshots.

Check the timers and recent results:

```sh
ssh orvo-prod-postgres 'systemctl list-timers orvo-postgres-backup.timer; journalctl -t orvo-backup -n 20 --no-pager'
ssh orvo-prod-clickhouse 'systemctl list-timers orvo-clickhouse-backup.timer; journalctl -t orvo-backup -n 20 --no-pager'

aws --profile orvo-admin --region eu-central-1 s3 ls \
  s3://orvo-production-backups-518902362990-eu-central-1/postgres/daily/
aws --profile orvo-admin --region eu-central-1 s3 ls \
  s3://orvo-production-backups-518902362990-eu-central-1/clickhouse/daily/
```

Run and verify an on-demand backup before a risky database operation:

```sh
ssh orvo-prod-postgres 'sudo systemctl start orvo-postgres-backup.service && systemctl is-failed orvo-postgres-backup.service'
ssh orvo-prod-clickhouse 'sudo systemctl start orvo-clickhouse-backup.service && systemctl is-failed orvo-clickhouse-backup.service'
```

`systemctl is-failed` should print `inactive` for a successful oneshot service.

## Recovery

Do not restore over the live data volume first. Create replacement storage or a replacement instance, restore there, validate row counts and application queries, and then cut over the private connection address.

For PostgreSQL, download the selected `.dump` object and restore it with `pg_restore` into an empty database. For ClickHouse, use `RESTORE DATABASE default FROM Disk('backups', '<backup-name>')` on a replacement server with the same S3 backup-disk configuration.

EBS snapshots are the fallback when logical restore is unavailable. Create a new volume from the selected snapshot and attach it to a replacement instance; do not detach or overwrite a healthy production volume during validation.

## Scaling and maintenance

- Stop the affected service before changing its data volume.
- Snapshot a database volume before resizing or replacing it.
- Prefer changing the instance type in place when only CPU or memory is constrained.
- Expand the filesystem after increasing an EBS volume; AWS does not shrink EBS volumes.
- Keep the app host's Elastic IP allocated and reassociate it if the host is replaced.
- After any database or security-group change, verify app and ingest health plus a real database-backed request.

The host-monitoring agent can be installed independently on each host. Monitoring changes must not contain database credentials and should report the backup timers and their most recent successful journal entries.
