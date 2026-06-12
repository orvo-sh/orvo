import { GolangIcon } from "@repo/components/icons/golang";
import { JavaIcon } from "@repo/components/icons/java";
import { NodejsIcon } from "@repo/components/icons/nodejs";
import { PythonIcon } from "@repo/components/icons/python";
import { RustIcon } from "@repo/components/icons/rust";

const ingestEndpoint = "https://ingest.orvo.sh";


export const tabs = [
  {
    value: "node",
    label: "Node.js",
    icon: NodejsIcon,
    install:
      "npm install @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/exporter-metrics-otlp-http @opentelemetry/exporter-logs-otlp-http",
    body: "The Node.js SDK auto-instruments common frameworks and sends spans, metrics, and logs via OTLP HTTP.",
    snippet: `import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: '${ingestEndpoint}/v1/traces',
    headers: { 'x-ingestion-key': 'YOUR_KEY' }
  }),
  metricExporter: new OTLPMetricExporter({
    url: '${ingestEndpoint}/v1/metrics',
    headers: { 'x-ingestion-key': 'YOUR_KEY' }
  }),
  logRecordExporter: new OTLPLogExporter({
    url: '${ingestEndpoint}/v1/logs',
    headers: { 'x-ingestion-key': 'YOUR_KEY' }
  })
});

sdk.start();`,
  },
  {
    value: "python",
    label: "Python",
    icon: PythonIcon,
    install: "pip install opentelemetry-distro opentelemetry-exporter-otlp",
    body: "Use the OTLP HTTP exporters to send traces, metrics, and logs to Orvo. The following snippet configures the trace provider.",
    snippet: `from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.log_exporter import OTLPLogExporter

provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter(
    endpoint="${ingestEndpoint}/v1/traces",
    headers={"x-ingestion-key": "YOUR_KEY"}
))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

# Metrics and logs follow the same pattern`,
  },
  {
    value: "go",
    label: "Go",
    icon:GolangIcon,
    install: `go get go.opentelemetry.io/otel \\\n  go.opentelemetry.io/otel/sdk \\\n  go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp`,
    body: "In Go, create an OTLP HTTP exporter and attach it to a tracer provider. The same pattern applies to metrics and logs using their respective OTLP packages.",
    snippet: `package main

import (
  "context"
  "go.opentelemetry.io/otel/sdk/trace"
  "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
)

func main() {
  exp, _ := otlptracehttp.New(context.Background(),
    otlptracehttp.WithEndpoint("ingest.orvo.sh"),
    otlptracehttp.WithURLPath("/v1/traces"),
    otlptracehttp.WithHeaders(map[string]string{
      "x-ingestion-key": "YOUR_KEY",
    }),
  )

  tp := trace.NewTracerProvider(
    trace.WithBatcher(exp),
  )
  defer tp.Shutdown(context.Background())
}`,
  },
  {
    value: "java",
    label: "Java",
    icon:JavaIcon,
    install:
      "<!-- Maven dependencies for opentelemetry-sdk, opentelemetry-exporter-otlp, and opentelemetry-api -->",
    body: "Configure the OTLP HTTP exporter with your endpoint and ingestion key. The same exporter handles traces, metrics, and logs.",
    snippet: `import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;

OtlpHttpSpanExporter exporter = OtlpHttpSpanExporter.builder()
  .setEndpoint("${ingestEndpoint}/v1/traces")
  .addHeader("x-ingestion-key", "YOUR_KEY")
  .build();

SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
  .addSpanProcessor(BatchSpanProcessor.builder(exporter).build())
  .build();`,
  },
  {
    value: "rust",
    label: "Rust",
    icon:RustIcon,
    install:
      "cargo add opentelemetry opentelemetry-otlp opentelemetry-sdk tokio",
    body: "Use the OTLP HTTP exporter in the OpenTelemetry SDK. Configure the endpoint and headers, then build your tracer provider.",
    snippet: `use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::trace::TracerProvider;

let tracer_provider = TracerProvider::builder()
  .with_batch_exporter(
    opentelemetry_otlp::new_exporter()
      .http()
      .with_endpoint("${ingestEndpoint}/v1/traces")
      .with_headers(
        std::collections::HashMap::from([
          ("x-ingestion-key".into(), "YOUR_KEY".into())
        ])
      )
  )
  .build();`,
  },
] as const;
