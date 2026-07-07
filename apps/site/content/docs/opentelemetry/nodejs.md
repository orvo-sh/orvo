---
title: Node.js
description: Send OpenTelemetry data from a Node.js application to Orvo.
order: 2
previous: opentelemetry/overview
next: opentelemetry/go
---
# Node.js

Node.js is one of the fastest ways to get full Orvo value because the OpenTelemetry ecosystem already covers common HTTP, database, and framework paths well.

## Install dependencies

```bash
npm install @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http @opentelemetry/exporter-logs-otlp-http
```

## Configure OpenTelemetry

At minimum, set your service and environment clearly.

```bash
export OTEL_SERVICE_NAME=checkout-api
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
```

## Send data to Orvo

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

## Verify telemetry

After one test request, confirm that Orvo shows:

- Logs for `checkout-api`
- Traces for the request path you triggered
- Metrics in the same environment

## Common issues

- Exporters start too late in the boot sequence.
- The service name defaults to something vague.
- You send traces but forget logs or metrics.
- Your header uses the wrong auth format.

## Related pages

- [OpenTelemetry overview](/docs/opentelemetry/overview)
- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
