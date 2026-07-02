---
title: Logs
description: Search structured logs, narrow down noisy streams, and move directly into incident context.
category: Signals
order: 1
slug: logs
previous: installation/install-the-collector
next: signals/traces
---

# Logs

Logs are often the fastest way to explain exactly what happened during an incident. Orvo keeps them searchable and tied back to the service and trace context that made them relevant.

## Filter aggressively

The useful workflow is usually to narrow by service, environment, severity, and request context first. Broad searches create more noise than signal.

## Pivot from logs into traces

When a log line includes a trace or span reference, use that to move into the full request path instead of continuing to debug from isolated events.
