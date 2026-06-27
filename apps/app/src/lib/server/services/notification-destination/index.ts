import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { NotificationDeliveryService } from "../notification-delivery";
import { createCreateNotificationDestination } from "./methods/create-notification-destination";
import { createDeleteNotificationDestination } from "./methods/delete-notification-destination";
import { createListNotificationDestinations } from "./methods/list-notification-destinations";
import { createTestNotificationDestination } from "./methods/test-notification-destination";
import { createUpdateNotificationDestination } from "./methods/update-notification-destination";
import {
  createGetDefaultEmailRecipients,
  createPrepareDestinationInput,
  decodeDestinationHeaders,
} from "./shared";
import {
  createNotificationDestinationInputSchema,
  deleteNotificationDestinationInputSchema,
  testNotificationDestinationInputSchema,
  updateNotificationDestinationInputSchema,
} from "./schema";

@Instrument({ prefix: "notificationDestination" })
class NotificationDestinationService {
  private logger: Logger;
  private listNotificationDestinationsMethod: ReturnType<
    typeof createListNotificationDestinations
  >;
  private getDefaultEmailRecipientsMethod: ReturnType<
    typeof createGetDefaultEmailRecipients
  >;
  private createNotificationDestinationMethod: ReturnType<
    typeof createCreateNotificationDestination
  >;
  private updateNotificationDestinationMethod: ReturnType<
    typeof createUpdateNotificationDestination
  >;
  private deleteNotificationDestinationMethod: ReturnType<
    typeof createDeleteNotificationDestination
  >;
  private testNotificationDestinationMethod: ReturnType<
    typeof createTestNotificationDestination
  >;

  constructor(
    private db: DB,
    logger: Logger,
    private encryption: Encryption,
    private notificationDeliveryService: NotificationDeliveryService,
  ) {
    this.logger = logger.child("NotificationDestinationService");
    this.getDefaultEmailRecipientsMethod = createGetDefaultEmailRecipients({
      db: this.db,
      logger: this.logger,
    });
    const prepareDestinationInput = createPrepareDestinationInput({
      encryption: this.encryption,
      getDefaultEmailRecipients: this.getDefaultEmailRecipientsMethod,
    });
    const decodeHeaders = decodeDestinationHeaders({
      encryption: this.encryption,
    });
    this.listNotificationDestinationsMethod =
      createListNotificationDestinations({
        db: this.db,
        logger: this.logger,
        decodeHeaders,
      });
    this.createNotificationDestinationMethod =
      createCreateNotificationDestination({
        db: this.db,
        logger: this.logger,
        prepareDestinationInput,
      });
    this.updateNotificationDestinationMethod =
      createUpdateNotificationDestination({
        db: this.db,
        logger: this.logger,
        prepareDestinationInput,
      });
    this.deleteNotificationDestinationMethod =
      createDeleteNotificationDestination({
        db: this.db,
        logger: this.logger,
      });
    this.testNotificationDestinationMethod = createTestNotificationDestination({
      db: this.db,
      logger: this.logger,
      notificationDeliveryService: this.notificationDeliveryService,
    });
  }

  async listNotificationDestinations(context: { appId: string }) {
    return this.listNotificationDestinationsMethod(context);
  }

  async getDefaultEmailRecipients(context: { organizationId: string }) {
    return this.getDefaultEmailRecipientsMethod(context);
  }

  async createNotificationDestination(
    input: z.input<typeof createNotificationDestinationInputSchema>,
    context: { appId: string; organizationId: string; userId: string },
  ) {
    return this.createNotificationDestinationMethod(input, context);
  }

  async updateNotificationDestination(
    input: z.input<typeof updateNotificationDestinationInputSchema>,
    context: { appId: string; organizationId: string; userId: string },
  ) {
    return this.updateNotificationDestinationMethod(input, context);
  }

  async deleteNotificationDestination(
    input: z.input<typeof deleteNotificationDestinationInputSchema>,
    context: { appId: string },
  ) {
    return this.deleteNotificationDestinationMethod(input, context);
  }

  async testNotificationDestination(
    input: z.input<typeof testNotificationDestinationInputSchema>,
    context: { appId: string },
  ) {
    return this.testNotificationDestinationMethod(input, context);
  }
}
export * from "./schema";
export { NotificationDestinationService };
