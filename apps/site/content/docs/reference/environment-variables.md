---
title: Environment variables
description: Configure Orvo services and optional integrations.
order: 2
previous: reference/api
next: reference/limits
---

# Environment variables

Use environment variables to configure a self-hosted Orvo deployment and its optional cloud integrations. Start with the repository's `.env.example` files, then provide secrets through your deployment platform rather than committing them.

## App service variables

Core app runtime:

```env
POSTGRES_URL="postgresql://postgres:password@localhost:5432/orvo"
CLICKHOUSE_URL="http://localhost:8123"
ORIGIN="https://app.orvo.sh"
INGEST_BASE_URL="https://ingest.orvo.sh"
ENCRYPTION_SECRET="replace-me"
BETTER_AUTH_SECRET="replace-me"
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="Orvo <notifications@example.com>"
```

Optional platform integrations:

```env
GITHUB_CLIENT_ID="github-oauth-client-id"
GITHUB_CLIENT_SECRET="github-oauth-client-secret"
SLACK_CLIENT_ID="slack-client-id"
SLACK_CLIENT_SECRET="slack-client-secret"
SLACK_SIGNING_SECRET="slack-signing-secret"
STRIPE_SECRET_KEY="sk_live_or_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_PRICE_ID="price_..."
STRIPE_INGEST_OVERAGE_PRICE_ID="price_..."
STRIPE_SCOUT_OVERAGE_PRICE_ID="price_..."
BILLING_SALES_EMAIL="sales@example.com"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5.6-luna"
```

Optional uploads/storage:

```env
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_ENDPOINT="https://s3.example.com"
S3_REGION="eu-west-1"
S3_BUCKET_NAME="orvo-uploads"
CDN_BASE_URL="https://cdn.example.com"
```

Optional self-telemetry for the app server:

```env
PROD_OTEL_BASE_URL="https://ingest.orvo.sh"
PROD_OTEL_INGEST_KEY="ing_test_or_prod_..."
PUBLIC_ORVO_OTLP_BASE_URL="https://ingest.orvo.sh"
```

## Ingest service variables

The ingest service reads:

```env
POSTGRES_URL="postgresql://postgres:password@localhost:5432/orvo"
CLICKHOUSE_URL="http://localhost:8123"
ENVIRONMENT="development"
INGEST_HTTP_PORT="4318"
INGEST_WORKER_FLUSH_INTERVAL="5s"
INGEST_WORKER_LOGS_BATCH_SIZE="1000"
INGEST_WORKER_TRACES_BATCH_SIZE="1000"
INGEST_WORKER_METRICS_BATCH_SIZE="1000"
INGEST_WORKER_HEARTBEAT_BATCH_SIZE="500"
INGEST_WORKER_MAX_QUEUE_SIZE="10000"
OTEL_ENDPOINT="https://ingest.orvo.sh"
OTEL_INGESTION_KEY="ing_test_..."
```

## Notes

- Never commit real secrets to the repo.
- Use placeholders in local examples and docs.
- Keep `INGEST_BASE_URL` and any SDK exporter endpoints aligned.
- GitHub, Slack, Stripe, email delivery, object storage, and Scout are optional. Configure only the integrations enabled in your deployment.

## Related pages

- [API](/docs/reference/api)
- [Send your first telemetry](/docs/getting-started/send-your-first-telemetry)
- [Limits](/docs/reference/limits)
