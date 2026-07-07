---
title: Go
description: Send OpenTelemetry data from a Go application to Orvo.
order: 3
previous: opentelemetry/nodejs
next: opentelemetry/python
---
# Go

Go services work well with Orvo when you keep the setup explicit and use OTLP HTTP exporters.

## Install dependencies

```bash
go get go.opentelemetry.io/otel   go.opentelemetry.io/otel/sdk   go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp
```

Add the matching metrics and logs packages if you are exporting those signals from the same service.

## Configure OpenTelemetry

Use a clear service name and environment:

```bash
export OTEL_SERVICE_NAME=checkout-api
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
```

## Send data to Orvo

```go
exp, _ := otlptracehttp.New(context.Background(),
  otlptracehttp.WithEndpoint("ingest.orvo.sh"),
  otlptracehttp.WithURLPath("/v1/traces"),
  otlptracehttp.WithHeaders(map[string]string{
    "Authorization": "Bearer YOUR_INGESTION_KEY",
  }),
)
```

The same pattern applies to logs and metrics with their OTLP HTTP exporters.

## Verify telemetry

Trigger one request and confirm the trace lands in [Traces](/docs/product/traces). Then confirm logs and metrics line up for the same service.

## Common issues

- Using the wrong OTLP path
- Forgetting the bearer token header
- Missing resource attributes such as `deployment.environment`

## Related pages

- [Collector](/docs/opentelemetry/collector)
- [Verify your setup](/docs/getting-started/verify-your-setup)
