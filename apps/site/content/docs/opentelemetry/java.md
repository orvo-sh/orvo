---
title: Java
description: Send OpenTelemetry data from a Java application to Orvo.
order: 5
previous: opentelemetry/python
next: opentelemetry/dotnet
---
# Java

For Java services, the simplest reliable path is usually the official OpenTelemetry SDK or Java agent with OTLP HTTP export.

## Install dependencies

Use the OpenTelemetry SDK and OTLP exporter packages that match your current Java setup.

If you are already standardized on the Java agent, prefer that instead of building custom instrumentation first.

## Configure OpenTelemetry

A practical starting point is environment-based configuration:

```bash
export OTEL_SERVICE_NAME=orders-api
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
export OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.orvo.sh
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_INGESTION_KEY"
```

## Send data to Orvo

If you prefer SDK code, configure the OTLP HTTP exporter for traces first and add logs and metrics the same way.

The important parts are:

- Base endpoint set to Orvo ingest
- Authorization header as a bearer token
- Clear service and environment attributes

## Verify telemetry

Generate one test request, then confirm that Orvo shows the service under the expected name and environment.

## Common issues

- Exporting to gRPC defaults when you intended HTTP
- Missing `Authorization` header formatting
- Agent and app config disagreeing on service name

## Related pages

- [OpenTelemetry overview](/docs/opentelemetry/overview)
- [Verify your setup](/docs/getting-started/verify-your-setup)
