import type { DB } from "@repo/db";
import { createGetOnboardingProgress } from "./methods/get-onboarding-progress";
import { createCompleteOnboardingMilestone } from "./methods/complete-onboarding-milestone";
import { completeOnboardingMilestoneInputSchema } from "./schema";
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

  private getOnboardingProgressMethod: ReturnType<
    typeof createGetOnboardingProgress
  >;
  private completeOnboardingMilestoneMethod: ReturnType<
    typeof createCompleteOnboardingMilestone
  >;

  constructor(
    db: DB,
    private ingestionKeyService: IngestionKeyService,
    private config: { otlpBaseUrl: string },
    logger: Logger,
  ) {
    this.logger = logger.child("OnboardingService");
    this.getOnboardingProgressMethod = createGetOnboardingProgress({
      db,
      logger: this.logger,
    });
    this.completeOnboardingMilestoneMethod = createCompleteOnboardingMilestone({
      db,
      logger: this.logger,
    });
    this.sendTestTelemetryMethod = createSendTestTelemetry({
      ingestionKeyService: this.ingestionKeyService,
      logger: this.logger,
      config: this.config,
    });
  }

  async getOnboardingProgress(context: { userId: string }) {
    return this.getOnboardingProgressMethod(context);
  }

  async completeOnboardingMilestone(
    input: z.input<typeof completeOnboardingMilestoneInputSchema>,
    context: { userId: string },
  ) {
    return this.completeOnboardingMilestoneMethod(input, context);
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
