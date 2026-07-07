---
title: Collector
description: Use the OpenTelemetry Collector with Orvo.
order: 8
previous: opentelemetry/rust
next: product/overview
---
# Collector

The OpenTelemetry Collector is the right choice when you want one place to receive, process, and forward telemetry before it reaches Orvo.

## When to use it

Use the Collector when you need to:

- Fan in telemetry from multiple services
- Add processors such as batching or attribute cleanup
- Normalize data before export
- Route infrastructure or host telemetry alongside app telemetry

## Configure the exporter

A minimal OTLP HTTP exporter looks like this:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:

processors:
  batch:

exporters:
  otlphttp/orvo:
    endpoint: https://ingest.orvo.sh
    headers:
      Authorization: Bearer YOUR_INGESTION_KEY

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/orvo]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/orvo]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/orvo]
```

## Verify telemetry

After the Collector is running, make a test request and confirm that Orvo shows the right service name, environment, and timestamps.

## Common issues

- The exporter header is missing the `Bearer` prefix
- Resource processors overwrite service or environment metadata
- A receiver is enabled, but the pipeline does not export that signal

## Related pages

- [OpenTelemetry overview](/docs/opentelemetry/overview)
- [Metrics](/docs/product/metrics)
- [Hosts](/docs/product/hosts)
