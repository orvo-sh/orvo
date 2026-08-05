# Orvo Agent

Orvo Agent is a curated OpenTelemetry Collector distribution for host metrics.

## Local development

Run the agent in the foreground on macOS or Linux:

```bash
ORVO_OTLP_ENDPOINT=http://localhost:4318 \
ORVO_INGESTION_KEY=ing_your_key \
make dev
```

This uses a temporary configuration and state directory. Press `Ctrl+C` to stop it.

## Build

```bash
make build
```

The build creates `build/orvo-agent` and `build/orvo-agentctl`.

## Production installation

Generate a one-time command from the Hosts page in Orvo. The installer supports
Linux on amd64 and arm64.
