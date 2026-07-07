---
title: Python
description: Send OpenTelemetry data from a Python application to Orvo.
order: 4
previous: opentelemetry/go
next: opentelemetry/java
---
# Python

Python is a good fit for Orvo when you want quick instrumentation and readable structured logs around worker or API behavior.

## Install dependencies

```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp
```

## Configure OpenTelemetry

Set service and environment metadata first.

```bash
export OTEL_SERVICE_NAME=payments-worker
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production
```

## Send data to Orvo

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

provider = TracerProvider()
processor = BatchSpanProcessor(
    OTLPSpanExporter(
        endpoint="https://ingest.orvo.sh/v1/traces",
        headers={"Authorization": "Bearer YOUR_INGESTION_KEY"},
    )
)
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
```

Metrics and logs follow the same OTLP HTTP pattern.

## Verify telemetry

Run a known request or job once, then check [Traces](/docs/product/traces) and [Logs](/docs/product/logs).

## Common issues

- A worker process exits before the exporter flushes.
- Different services accidentally share the same name.
- Attributes are logged as free-form strings instead of structured fields.

## Related pages

- [Attributes](/docs/concepts/attributes)
- [Your first investigation](/docs/getting-started/your-first-investigation)
