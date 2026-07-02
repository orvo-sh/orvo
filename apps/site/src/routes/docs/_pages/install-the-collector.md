---
title: Install the collector
description: Set up an OpenTelemetry collector path so Orvo can receive telemetry from your stack.
category: Installation
order: 1
slug: install-the-collector
previous: getting-started/overview
next: signals/logs
---

# Install the collector

The fastest way to get useful telemetry into Orvo is to start with a collector path that can receive OTLP traffic from your services and forward it onward cleanly.

## Start with a single environment

Install the collector in one environment first so you can verify ingestion, resource attributes, and service naming before rolling the setup out more broadly.

## Keep resource metadata stable

Consistent service names, environment tags, and deployment metadata make the rest of the product easier to navigate later.

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:

exporters:
  otlphttp:
    endpoint: https://app.orvo.sh/otlp

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlphttp]
```
