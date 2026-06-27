import { Instrument } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";

import { createCreateOrganizationActivation } from "./methods/create-organization-activation";
import { createGetOrganizationActivation } from "./methods/get-organization-activation";
import { createMarkFirstAlertCreated } from "./methods/mark-first-alert-created";
import { createMarkTelemetryViewed } from "./methods/mark-telemetry-viewed";
import { createOrganizationActivationInputSchema } from "./schema";

@Instrument({ prefix: "organizationActivation" })
class OrganizationActivationService {
  private logger: Logger;
  private createOrganizationActivationMethod: ReturnType<
    typeof createCreateOrganizationActivation
  >;
  private getOrganizationActivationMethod: ReturnType<
    typeof createGetOrganizationActivation
  >;
  private markTelemetryViewedMethod: ReturnType<typeof createMarkTelemetryViewed>;
  private markFirstAlertCreatedMethod: ReturnType<
    typeof createMarkFirstAlertCreated
  >;

  constructor(
    private db: DB,
    logger: Logger,
  ) {
    this.logger = logger.child("OrganizationActivationService");
    this.createOrganizationActivationMethod =
      createCreateOrganizationActivation({
        db: this.db,
        logger: this.logger,
      });
    this.getOrganizationActivationMethod = createGetOrganizationActivation({
      db: this.db,
      logger: this.logger,
    });
    this.markTelemetryViewedMethod = createMarkTelemetryViewed({
      db: this.db,
      logger: this.logger,
    });
    this.markFirstAlertCreatedMethod = createMarkFirstAlertCreated({
      db: this.db,
      logger: this.logger,
    });
  }

  async createOrganizationActivation(
    input: z.input<typeof createOrganizationActivationInputSchema>,
  ) {
    return this.createOrganizationActivationMethod(input);
  }

  async getOrganizationActivation(context: { organizationId: string }) {
    return this.getOrganizationActivationMethod(context);
  }

  async markTelemetryViewed(context: { organizationId: string }) {
    return this.markTelemetryViewedMethod(context);
  }

  async markFirstAlertCreated(context: { organizationId: string }) {
    return this.markFirstAlertCreatedMethod(context);
  }
}

export * from "./schema";
export { OrganizationActivationService };
