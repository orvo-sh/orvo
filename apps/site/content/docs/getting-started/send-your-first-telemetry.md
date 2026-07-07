---
title: Send your first telemetry
description: Install OpenTelemetry and send your first logs, traces, or metrics to Orvo.
order: 2
previous: getting-started/introduction
next: getting-started/verify-your-setup
---
# Send your first telemetry

This page gets useful data into Orvo with the smallest practical setup.

## Before you start

You need:

- An Orvo app or workspace you want to send data from.
- An ingestion key from the app settings or onboarding flow.
- A service name such as `checkout-api` or `cartlane-web`.
- An environment value such as `production` or `staging`.

## Step 1: pick one service

Start with a single production service, not your whole fleet.

Good first candidates are:

- Your main API.
- A queue worker that handles a business-critical path.
- A checkout or auth service with obvious request flow.

For the rest of this guide, assume the service is `checkout-api`.

## Step 2: configure OTLP export

Orvo's ingest service accepts OTLP HTTP on these endpoints:

- `https://ingest.orvo.sh/v1/traces`
- `https://ingest.orvo.sh/v1/logs`
- `https://ingest.orvo.sh/v1/metrics`

Authentication is sent with an `Authorization` header:

```bash
Authorization: Bearer YOUR_INGESTION_KEY
```

You should also set:

- `OTEL_SERVICE_NAME=checkout-api`
- `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production`

## Step 3: add a minimal OpenTelemetry setup

If you are using Node.js, this is the shortest accurate starting point:

```ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

const headers = { Authorization: 'Bearer YOUR_INGESTION_KEY' };

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'https://ingest.orvo.sh/v1/traces',
    headers
  }),
  metricExporter: new OTLPMetricExporter({
    url: 'https://ingest.orvo.sh/v1/metrics',
    headers
  }),
  logRecordExporter: new OTLPLogExporter({
    url: 'https://ingest.orvo.sh/v1/logs',
    headers
  })
});

sdk.start();
```

If you are using another language, jump to:

- [Node.js](/docs/opentelemetry/nodejs)
- [Go](/docs/opentelemetry/go)
- [Python](/docs/opentelemetry/python)
- [Java](/docs/opentelemetry/java)
- [.NET](/docs/opentelemetry/dotnet)
- [Rust](/docs/opentelemetry/rust)

## Step 4: generate a test request

Make one request or job run you can easily recognize.

Examples:

- Open your checkout page and complete a test purchase.
- Call `POST /api/checkout` with a test cart.
- Run a worker once against known input.

The goal is not traffic volume. The goal is a request you can find again in Orvo.

## Step 5: confirm the signals arrive

Open Orvo and check that you can see:

- Logs from `checkout-api`.
- At least one trace for the request or job you triggered.
- Metrics tied to the same service and environment.

If nothing appears within a minute or two, go to [Verify your setup](/docs/getting-started/verify-your-setup).

:::info
Use real service names early. Generic names like `api` or `worker` make every later investigation harder than it needs to be.
:::

## What to do next

Move to [Verify your setup](/docs/getting-started/verify-your-setup) before you instrument more services. Clean metadata now saves a lot of cleanup later.
