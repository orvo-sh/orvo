import { Instrument } from "$lib/instrumentation";
import type { Auth } from "$lib/server/auth";
import type { Email } from "$lib/server/email";
import type { Subscription } from "@better-auth/stripe";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { z } from "zod";
import Stripe from "stripe";

import { createCreateBillingPortalSession } from "./methods/create-billing-portal-session";
import { createGetBillingState } from "./methods/get-billing-state";
import { createGetOrganizationAccessState } from "./methods/get-organization-access-state";
import { createOnSubscriptionCreated } from "./methods/on-subscription-created";
import { createStartFreeTrial } from "./methods/start-free-trial";
import { createSyncMeterUsage } from "./methods/sync-meter-usage";
import { createOnSubscriptionDeleted } from "./methods/subscription-lifecycle";
import { createUpdateBillingEmail } from "./methods/update-billing-email";
import { createUpdateOverageSettings } from "./methods/update-overage-settings";
import {
  createBillingPortalInputSchema,
  startFreeTrialInputSchema,
  updateBillingEmailInputSchema,
  updateOverageSettingsInputSchema,
} from "./schema";
import {
  createGetCurrentSubscription,
  createIsOrganizationOwner,
  createSyncStripeSubscriptionState,
} from "./shared";

@Instrument({ prefix: "billing" })
class BillingService {
  private logger: Logger;
  private getBillingStateMethod: ReturnType<typeof createGetBillingState>;
  private getOrganizationAccessStateMethod: ReturnType<
    typeof createGetOrganizationAccessState
  >;
  private createBillingPortalSessionMethod: ReturnType<
    typeof createCreateBillingPortalSession
  >;
  private updateBillingEmailMethod: ReturnType<typeof createUpdateBillingEmail>;
  private updateOverageSettingsMethod: ReturnType<
    typeof createUpdateOverageSettings
  >;
  private startFreeTrialMethod: ReturnType<typeof createStartFreeTrial>;
  private onSubscriptionCreatedMethod: ReturnType<
    typeof createOnSubscriptionCreated
  >;
  private syncMeterUsageMethod: ReturnType<typeof createSyncMeterUsage>;
  private onSubscriptionDeletedMethod: ReturnType<
    typeof createOnSubscriptionDeleted
  >;

  constructor(
    db: DB,
    logger: Logger,
    _email: Email,
    stripe: Stripe,
    config: {
      proPriceId: string;
      ingestOveragePriceId: string;
      scoutOveragePriceId: string;
      trialDays: number;
      ingestEventName: string;
      scoutEventName: string;
    },
  ) {
    this.logger = logger.child("BillingService");
    const isOrganizationOwner = createIsOrganizationOwner({
      db,
    });
    const getCurrentSubscription = createGetCurrentSubscription({
      db,
    });
    const syncStripeSubscriptionState = createSyncStripeSubscriptionState({
      db,
      config,
    });

    this.getBillingStateMethod = createGetBillingState({
      db,
      logger: this.logger,
      stripe,
      getCurrentSubscription,
      isOrganizationOwner,
    });
    this.getOrganizationAccessStateMethod = createGetOrganizationAccessState({
      db,
      logger: this.logger,
      getCurrentSubscription,
    });
    this.createBillingPortalSessionMethod = createCreateBillingPortalSession({
      db,
      logger: this.logger,
      isOrganizationOwner,
    });
    this.updateBillingEmailMethod = createUpdateBillingEmail({
      logger: this.logger,
      isOrganizationOwner,
    });
    this.updateOverageSettingsMethod = createUpdateOverageSettings({
      db,
      logger: this.logger,
      isOrganizationOwner,
    });
    this.startFreeTrialMethod = createStartFreeTrial({
      db,
      logger: this.logger,
      stripe,
      config,
      isOrganizationOwner,
      syncStripeSubscriptionState,
    });
    this.onSubscriptionCreatedMethod = createOnSubscriptionCreated({
      logger: this.logger,
      stripe,
      syncStripeSubscriptionState,
    });
    this.syncMeterUsageMethod = createSyncMeterUsage({
      db,
      logger: this.logger,
      stripe,
      config,
    });
    this.onSubscriptionDeletedMethod = createOnSubscriptionDeleted({ db });
  }

  async getBillingState(context: { organizationId: string; userId?: string }) {
    return this.getBillingStateMethod(context);
  }

  async getOrganizationAccessState(context: { organizationId: string }) {
    return this.getOrganizationAccessStateMethod(context);
  }

  async createBillingPortalSession(
    input: z.input<typeof createBillingPortalInputSchema>,
    context: {
      organizationId: string;
      userId: string;
      headers: Headers;
      origin: string;
      authService: Auth;
    },
  ) {
    return this.createBillingPortalSessionMethod(input, context);
  }

  async updateBillingEmail(
    input: z.input<typeof updateBillingEmailInputSchema>,
    context: { organizationId: string; userId: string },
  ) {
    return this.updateBillingEmailMethod(input, context);
  }

  async updateOverageSettings(
    input: z.input<typeof updateOverageSettingsInputSchema>,
    context: { organizationId: string; userId: string },
  ) {
    return this.updateOverageSettingsMethod(input, context);
  }

  async startFreeTrial(
    input: z.input<typeof startFreeTrialInputSchema>,
    context: {
      organizationId: string;
      userId: string;
    },
  ) {
    return this.startFreeTrialMethod(input, context);
  }

  async onSubscriptionCreated(subscription: Subscription) {
    return this.onSubscriptionCreatedMethod(subscription);
  }

  async syncMeterUsage() {
    return this.syncMeterUsageMethod();
  }

  async onSubscriptionDeleted(_context: { organizationId: string }) {
    return this.onSubscriptionDeletedMethod(_context);
  }
}

export * from "./schema";
export { BillingService };
