---
name: orvo-onboard
description: Set up OpenTelemetry in a project and send traces, logs, and metrics to Orvo.
---

# Set up Orvo observability

## 1. Inspect the project

Identify the runtime services, frameworks, package manager, startup commands, and any existing OpenTelemetry SDK, Collector, or telemetry vendor. Start with the service the user named. If they did not name one, start with the main backend or worker and explain the choice. Reuse existing instrumentation and preserve existing exporters. If the project already routes telemetry through a Collector, add Orvo to the relevant Collector pipelines rather than adding another SDK.

## 2. Configure ingestion

Use the endpoint and ingestion key for the target Orvo app. For Orvo Cloud, create or select an app at https://app.orvo.sh and get an ingestion key from the app onboarding flow or ingestion key settings. For a self-hosted instance, use its configured ingestion endpoint.

Configure the exporter to use OTLP HTTP. For SDKs that support the standard environment variables, the Orvo Cloud configuration is:

```sh
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.orvo.sh
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_INGESTION_KEY"
```

Use the project's runtime secret configuration to supply the actual authorization header. Keep ingestion keys out of source control, client bundles, and command output. If a key is unavailable, prepare the configuration with a placeholder in the project's environment example and tell the user where to supply the real secret. Only test remote export once a valid key is configured.

For exporters that require a full signal URL, append `/v1/traces`, `/v1/logs`, or `/v1/metrics` as appropriate. Give each service a stable `service.name` and set `deployment.environment` to the actual deployment environment.

## 3. Instrument the service

Use the OpenTelemetry SDK or framework integration for the service's runtime. Initialize it before the framework or other modules it needs to instrument, using the project's existing startup conventions. Configure traces, logs, and metrics as supported by the runtime and project. Reuse the existing logger and add trace correlation where supported. Keep payloads, credentials, and personal data out of telemetry attributes.

Consult the relevant [Orvo OpenTelemetry guide](https://orvo.sh/docs/opentelemetry/overview) for runtime-specific setup and [Send your first telemetry](https://orvo.sh/docs/getting-started/send-your-first-telemetry) for the end-to-end flow.

## 4. Verify and hand off

Run the project's usual checks, start the instrumented service, and trigger a recognizable test request or job in a development environment. With a valid key, check exporter diagnostics and confirm the expected signals in Orvo under the correct service and environment if you have dashboard access. See [Verify your setup](https://orvo.sh/docs/getting-started/verify-your-setup) for troubleshooting.

Report what you instrumented, how you tested it, and which signals you confirmed in Orvo. If any signal could not be verified, say what the user needs to do to verify it.
