---
title: API
description: Reference for the Orvo HTTP API.
order: 1
previous: integrations/github
next: reference/environment-variables
---

# API

This page documents the public HTTP surfaces that are clear in the current codebase today.

## Ingest API

Orvo's ingest service accepts OTLP HTTP at:

- `/v1/logs`
- `/v1/traces`
- `/v1/metrics`

Heartbeat check-ins use:

- `/v1/heartbeats/{token}`

Health endpoints are also available at:

- `/health`
- `/ready`

## Authentication

Logs, traces, and metrics ingestion use a bearer token:

```http
Authorization: Bearer YOUR_INGESTION_KEY
```

Heartbeat check-ins are authenticated by the secret token embedded in the URL itself.

## Content type

The ingest service accepts OTLP payloads and is built to handle standard OTLP HTTP input, including JSON and protobuf forms used by OpenTelemetry tooling.

## Common response behavior

Successful ingest requests return standard OTLP success responses. The onboarding service currently treats `202 Accepted` as the success case for test telemetry sends.

## Error handling

See [Error codes](/docs/reference/error-codes) for the currently implemented ingest error identifiers.

## Related pages

- [Environment variables](/docs/reference/environment-variables)
- [OpenTelemetry overview](/docs/opentelemetry/overview)
