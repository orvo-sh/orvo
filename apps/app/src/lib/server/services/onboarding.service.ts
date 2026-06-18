import type { IngestionKeyService } from "$lib/server/services/ingestion-key.service";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

class OnboardingService {
  private logger: Logger;

  constructor(
    private ingestionKeyService: IngestionKeyService,
    private config: { otlpBaseUrl: string },
    logger: Logger,
  ) {
    this.logger = logger.child("OnboardingService");
  }

  async sendTestTelemetry(
    input: z.input<typeof sendTestTelemetryInputSchema>,
    context: { appId: string; userId: string },
  ) {
    this.logger.info("sendTestTelemetry: sending test telemetry", {
      input,
      context,
    });

    const validated = sendTestTelemetryInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const keyResult = await this.ingestionKeyService.createIngestionKey(
        { kind: "private" },
        { appId: context.appId, userId: context.userId },
      );

      if (!keyResult.success) {
        return err(keyResult.error);
      }

      const key = keyResult.data.key;
      const otlpBaseUrl = this.config.otlpBaseUrl;
      const signals = validated.data.signals;

      const results: Array<{ signal: string; status: number }> = [];

      if (signals.includes("traces")) {
        const response = await fetch(`${otlpBaseUrl}/v1/traces`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(buildTestTracePayload()),
        });
        results.push({ signal: "traces", status: response.status });
      }

      if (signals.includes("logs")) {
        const response = await fetch(`${otlpBaseUrl}/v1/logs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(buildTestLogPayload()),
        });
        results.push({ signal: "logs", status: response.status });
      }

      if (signals.includes("metrics")) {
        const response = await fetch(`${otlpBaseUrl}/v1/metrics`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(buildTestMetricPayload()),
        });
        results.push({ signal: "metrics", status: response.status });
      }

      const failures = results.filter((result) => result.status !== 202);
      if (failures.length > 0) {
        this.logger.error(
          `sendTestTelemetry: some signals failed: ${JSON.stringify(results)}`,
        );
        return err("Failed to send some test signals.");
      }

      return ok({ sentAt: new Date().toISOString(), signals });
    } catch (error) {
      this.logger.error(
        "sendTestTelemetry: failed to send test telemetry",
        error as Error,
      );
      return err("Failed to send test telemetry.");
    }
  }
}

const sendTestTelemetryInputSchema = z.object({
  signals: z.array(z.enum(["traces", "logs", "metrics"])),
});

function generateHexId(length: number): string {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function attr(key: string, value: string) {
  return { key, value: { stringValue: value } };
}

function buildTestTracePayload() {
  const traceId = generateHexId(32);
  const rootSpanId = generateHexId(16);
  const childSpanId = generateHexId(16);
  const nowMs = Date.now();

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [attr("service.name", "orvo-onboarding")],
        },
        scopeSpans: [
          {
            scope: { name: "orvo-onboarding" },
            spans: [
              {
                traceId,
                spanId: rootSpanId,
                name: "GET /health",
                kind: 2,
                startTimeUnixNano: `${nowMs}000000`,
                endTimeUnixNano: `${nowMs + 50}000000`,
                attributes: [],
                status: { code: 1 },
              },
              {
                traceId,
                spanId: childSpanId,
                parentSpanId: rootSpanId,
                name: "postgres.query",
                kind: 2,
                startTimeUnixNano: `${nowMs}000000`,
                endTimeUnixNano: `${nowMs + 20}000000`,
                attributes: [attr("db.system", "postgresql")],
                status: { code: 1 },
              },
            ],
          },
        ],
      },
    ],
  };
}

function buildTestLogPayload() {
  const nowMs = Date.now();

  return {
    resourceLogs: [
      {
        resource: {
          attributes: [attr("service.name", "orvo-onboarding")],
        },
        scopeLogs: [
          {
            scope: { name: "orvo-onboarding" },
            logRecords: [
              {
                timeUnixNano: `${nowMs}000000`,
                severityText: "INFO",
                body: { stringValue: "Hello from Orvo" },
                attributes: [],
              },
            ],
          },
        ],
      },
    ],
  };
}

function buildTestMetricPayload() {
  const nowMs = Date.now();

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [attr("service.name", "orvo-onboarding")],
        },
        scopeMetrics: [
          {
            scope: { name: "orvo-onboarding" },
            metrics: [
              {
                name: "cpu.usage",
                description: "Example CPU usage metric from Orvo onboarding.",
                unit: "1",
                gauge: {
                  dataPoints: [
                    {
                      timeUnixNano: `${nowMs}000000`,
                      asDouble: 42,
                      attributes: [],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

export { OnboardingService, sendTestTelemetryInputSchema };
