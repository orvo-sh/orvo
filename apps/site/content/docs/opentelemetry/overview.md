---
title: OpenTelemetry overview
description: Understand how Orvo works with OpenTelemetry.
order: 1
previous: concepts/incidents
next: opentelemetry/nodejs
---
# OpenTelemetry overview

Orvo is OpenTelemetry-native. That means you can send standard OTLP logs, traces, and metrics without adopting a vendor-specific SDK.

## Why this matters

OpenTelemetry gives you:

- Portable instrumentation
- Standard resource attributes
- Consistent trace context
- A cleaner path to logs, traces, and metrics from the same app

## What Orvo expects

The current ingest service accepts OTLP HTTP on:

- `/v1/logs`
- `/v1/traces`
- `/v1/metrics`

It authenticates requests with:

```text
Authorization: Bearer YOUR_INGESTION_KEY
```

## Set these fields early

Before you tune anything else, make sure you set:

- `service.name`
- `deployment.environment`
- Useful request and business attributes

Those three decisions do more for Orvo usability than most exporter tweaks.

## Verification still matters

A successful export does not guarantee a useful setup. Always verify:

- The service names are clean
- Production and staging are separate
- Logs carry structured attributes
- Traces actually connect the services you care about

## Related pages

- [Send your first telemetry](/docs/getting-started/send-your-first-telemetry)
- [Verify your setup](/docs/getting-started/verify-your-setup)
- [Collector](/docs/opentelemetry/collector)
