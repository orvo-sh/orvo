import { recordError } from "$lib/instrumentation";
import type { IngestionKeyService } from "$lib/server/services/ingestion-key";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { sendTestTelemetryInputSchema } from "../schema";
import {
  buildTestLogPayload,
  buildTestMetricPayload,
  buildTestTracePayload,
} from "../shared";

const createSendTestTelemetry = ({
  ingestionKeyService,
  logger,
  config,
}: {
  ingestionKeyService: IngestionKeyService;
  logger: Logger;
  config: { otlpBaseUrl: string };
}) => async (
  input: z.input<typeof sendTestTelemetryInputSchema>,
  context: { appId: string; userId: string },
) => {
  const validated = sendTestTelemetryInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    const keyResult = await ingestionKeyService.createIngestionKey(
      { kind: "private" },
      { appId: context.appId, userId: context.userId },
    );

    if (!keyResult.success) {
      return err(keyResult.error);
    }

    const key = keyResult.data.key;
    const otlpBaseUrl = config.otlpBaseUrl;
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
      logger.error(`Some onboarding signals failed: ${JSON.stringify(results)}`);
      return err("Failed to send some test signals.");
    }

    return ok({ sentAt: new Date().toISOString(), signals });
  } catch (error) {
    recordError(error);
    logger.error("Failed to send test telemetry", error as Error);
    return err("Failed to send test telemetry.");
  }
};

export { createSendTestTelemetry };
