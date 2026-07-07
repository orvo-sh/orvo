---
title: .NET
description: Send OpenTelemetry data from a .NET application to Orvo.
order: 6
previous: opentelemetry/java
next: opentelemetry/rust
---
# .NET

.NET services work well with Orvo when you keep resource metadata clear and export over OTLP HTTP.

## Install dependencies

Install the OpenTelemetry packages you already use for ASP.NET Core or worker services, plus the OTLP exporter.

## Configure OpenTelemetry

Start with the same core metadata as every other language:

```bash
OTEL_SERVICE_NAME=checkout-api
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.orvo.sh
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_INGESTION_KEY"
```

## Send data to Orvo

Configure the OTLP exporter in your app startup and make sure traces, logs, and metrics all point at the Orvo ingest base URL.

## Verify telemetry

After one request, check that the trace name is useful and that related logs include enough structured fields to search later.

## Common issues

- Only traces are exported, while logs stay local
- Service name is inherited from an assembly name you do not want
- Environment metadata is missing or inconsistent

## Related pages

- [Services](/docs/concepts/services)
- [Logs](/docs/product/logs)
- [Traces](/docs/product/traces)
