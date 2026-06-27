import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { NotificationDeliveryService } from "../notification-delivery";
import { createCreateAlertWebhookDestination } from "./methods/create-alert-webhook-destination";
import { createDeleteAlertWebhookDestination } from "./methods/delete-alert-webhook-destination";
import { createGetAlertWebhookDestinations } from "./methods/get-alert-webhook-destinations";
import { createTestAlertWebhookDestination } from "./methods/test-alert-webhook-destination";
import { createUpdateAlertWebhookDestination } from "./methods/update-alert-webhook-destination";
import {
  createAlertWebhookDestinationInputSchema,
  deleteAlertWebhookDestinationInputSchema,
  testAlertWebhookDestinationInputSchema,
  updateAlertWebhookDestinationInputSchema,
} from "./schema";

@Instrument({ prefix: "alertWebhookDestination" })
class AlertWebhookDestinationService {
  private logger: Logger;
  private getAlertWebhookDestinationsMethod: ReturnType<
    typeof createGetAlertWebhookDestinations
  >;
  private createAlertWebhookDestinationMethod: ReturnType<
    typeof createCreateAlertWebhookDestination
  >;
  private updateAlertWebhookDestinationMethod: ReturnType<
    typeof createUpdateAlertWebhookDestination
  >;
  private deleteAlertWebhookDestinationMethod: ReturnType<
    typeof createDeleteAlertWebhookDestination
  >;
  private testAlertWebhookDestinationMethod: ReturnType<
    typeof createTestAlertWebhookDestination
  >;

  constructor(
    private db: DB,
    logger: Logger,
    private encryption: Encryption,
    private notificationDeliveryService: NotificationDeliveryService,
  ) {
    this.logger = logger.child("AlertWebhookDestinationService");
    this.getAlertWebhookDestinationsMethod = createGetAlertWebhookDestinations({
      db: this.db,
      logger: this.logger,
      encryption: this.encryption,
    });
    this.createAlertWebhookDestinationMethod =
      createCreateAlertWebhookDestination({
        db: this.db,
        logger: this.logger,
        encryption: this.encryption,
      });
    this.updateAlertWebhookDestinationMethod =
      createUpdateAlertWebhookDestination({
        db: this.db,
        logger: this.logger,
        encryption: this.encryption,
      });
    this.deleteAlertWebhookDestinationMethod =
      createDeleteAlertWebhookDestination({
        db: this.db,
        logger: this.logger,
      });
    this.testAlertWebhookDestinationMethod =
      createTestAlertWebhookDestination({
        db: this.db,
        logger: this.logger,
        notificationDeliveryService: this.notificationDeliveryService,
      });
  }

  async getAlertWebhookDestinations(context: { appId: string }) {
    return this.getAlertWebhookDestinationsMethod(context);
  }

  async createAlertWebhookDestination(
    input: z.input<typeof createAlertWebhookDestinationInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.createAlertWebhookDestinationMethod(input, context);
  }

  async updateAlertWebhookDestination(
    input: z.input<typeof updateAlertWebhookDestinationInputSchema>,
    context: { appId: string; userId: string },
  ) {
    return this.updateAlertWebhookDestinationMethod(input, context);
  }

  async deleteAlertWebhookDestination(
    input: z.input<typeof deleteAlertWebhookDestinationInputSchema>,
    context: { appId: string },
  ) {
    return this.deleteAlertWebhookDestinationMethod(input, context);
  }

  async testAlertWebhookDestination(
    input: z.input<typeof testAlertWebhookDestinationInputSchema>,
    context: { appId: string },
  ) {
    return this.testAlertWebhookDestinationMethod(input, context);
  }
}
export * from "./schema";
export { AlertWebhookDestinationService };
