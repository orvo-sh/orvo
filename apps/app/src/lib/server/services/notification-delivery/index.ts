import { Instrument } from "$lib/instrumentation";
import type { Email } from "$lib/server/email";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Encryption } from "@repo/encryption";
import type { Logger } from "@repo/logger";
import { createCreateTestDelivery } from "./methods/create-test-delivery";
import { createProcessDueDeliveries } from "./methods/process-due-deliveries";
import { createSendToDestination } from "./shared";

@Instrument({ prefix: "notificationDelivery" })
class NotificationDeliveryService {
  private logger: Logger;
  private processDueDeliveriesMethod: ReturnType<typeof createProcessDueDeliveries>;
  private createTestDeliveryMethod: ReturnType<typeof createCreateTestDelivery>;

  constructor(
    private db: DB,
    logger: Logger,
    private encryption: Encryption,
    private email: Nullable<Email>,
  ) {
    this.logger = logger.child("NotificationDeliveryService");
    const sendToDestination = createSendToDestination({
      encryption: this.encryption,
      email: this.email,
    });
    this.processDueDeliveriesMethod = createProcessDueDeliveries({
      db: this.db,
      logger: this.logger,
      sendToDestination,
    });
    this.createTestDeliveryMethod = createCreateTestDelivery({
      db: this.db,
      logger: this.logger,
      sendToDestination,
    });
  }

  async processDueDeliveries(limit = 50) {
    return this.processDueDeliveriesMethod(limit);
  }

  async createTestDelivery(
    destination: typeof notificationDestination.$inferSelect,
    context: { appId: string },
  ) {
    return this.createTestDeliveryMethod(destination, context);
  }
}
export { NotificationDeliveryService };
