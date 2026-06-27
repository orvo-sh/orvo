import { Instrument } from "$lib/instrumentation";
import type { IngestionKeyService } from "$lib/server/services/ingestion-key";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createSendTestTelemetry } from "./methods/send-test-telemetry";
import { sendTestTelemetryInputSchema } from "./schema";

@Instrument({ prefix: "onboarding" })
class OnboardingService {
  private logger: Logger;
  private sendTestTelemetryMethod: ReturnType<typeof createSendTestTelemetry>;

  constructor(
    private ingestionKeyService: IngestionKeyService,
    private config: { otlpBaseUrl: string },
    logger: Logger,
  ) {
    this.logger = logger.child("OnboardingService");
    this.sendTestTelemetryMethod = createSendTestTelemetry({
      ingestionKeyService: this.ingestionKeyService,
      logger: this.logger,
      config: this.config,
    });
  }

  async sendTestTelemetry(
    input: z.input<typeof sendTestTelemetryInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.sendTestTelemetryMethod(input, context);
  }
}

export * from "./schema";
export { OnboardingService };
