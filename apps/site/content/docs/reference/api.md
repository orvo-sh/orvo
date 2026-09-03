---
title: API
description: Reference for the Orvo HTTP API.
order: 1
previous: integrations/mcp
next: reference/environment-variables
---

# API

Orvo accepts telemetry through the OpenTelemetry Protocol (OTLP) over HTTP. It also provides a dedicated endpoint for heartbeat check-ins.

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

## Successful responses

Successful ingest requests return `202 Accepted` with the standard OTLP response for the exported signal.

## Error handling

See [Error codes](/docs/reference/error-codes) for the identifiers returned when ingestion fails.

## Related pages

- [Environment variables](/docs/reference/environment-variables)
- [OpenTelemetry overview](/docs/opentelemetry/overview)
