---
title: Rust
description: Send OpenTelemetry data from a Rust application to Orvo.
order: 7
previous: opentelemetry/dotnet
next: opentelemetry/collector
---
# Rust

Rust services usually benefit from a small explicit tracing setup instead of a lot of runtime magic.

## Install dependencies

```bash
cargo add opentelemetry opentelemetry-otlp opentelemetry-sdk tokio
```

## Configure OpenTelemetry

Make sure you set service and environment attributes in the resource you attach to your provider.

## Send data to Orvo

```rust
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::trace::TracerProvider;

let tracer_provider = TracerProvider::builder()
  .with_batch_exporter(
    opentelemetry_otlp::new_exporter()
      .http()
      .with_endpoint("https://ingest.orvo.sh/v1/traces")
      .with_headers(std::collections::HashMap::from([
        ("Authorization".into(), "Bearer YOUR_INGESTION_KEY".into())
      ]))
  )
  .build();
```

## Verify telemetry

Send one request or job execution you can identify easily in Orvo.

## Common issues

- Exporter setup happens, but the provider is never installed globally
- The process exits before a batch flush
- Resource attributes are left blank

## Related pages

- [Collector](/docs/opentelemetry/collector)
- [Verify your setup](/docs/getting-started/verify-your-setup)
