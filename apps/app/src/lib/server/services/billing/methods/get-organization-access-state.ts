import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organization } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { eq } from "drizzle-orm";

import type { createGetCurrentSubscription } from "../shared";
import { billingStatusHasAccess } from "../shared";

const createGetOrganizationAccessState =
  ({
    db,
    logger,
    getCurrentSubscription,
    reconcileSubscriptions,
  }: {
    db: DB;
    logger: Logger;
    getCurrentSubscription: ReturnType<typeof createGetCurrentSubscription>;
    reconcileSubscriptions?: (context: {
      organizationId: string;
    }) => Promise<void>;
  }) =>
  async (context: { organizationId: string }) => {
    try {
      let [currentOrganization, currentSubscription] = await Promise.all([
        db.query.organization.findFirst({
          where: eq(organization.id, context.organizationId),
        }),
        getCurrentSubscription(context.organizationId),
      ]);

      if (
        reconcileSubscriptions &&
        currentSubscription?.status === "trialing" &&
        currentSubscription.trialEnd &&
        currentSubscription.trialEnd.getTime() <= Date.now() &&
        (!currentSubscription.updatedAt ||
          currentSubscription.updatedAt.getTime() < Date.now() - 5 * 60_000)
      ) {
        await reconcileSubscriptions(context);
        [currentOrganization, currentSubscription] = await Promise.all([
          db.query.organization.findFirst({
            where: eq(organization.id, context.organizationId),
          }),
          getCurrentSubscription(context.organizationId),
        ]);
      }

      const billingStatus =
        currentSubscription?.status ?? currentOrganization?.billingStatus;
      const trialExpired =
        currentSubscription?.trialEnd instanceof Date &&
        currentSubscription.trialEnd.getTime() <= Date.now() &&
        billingStatus !== "active";

      return ok({
        hasAccess: billingStatusHasAccess(billingStatus) && !trialExpired,
        billingStatus,
        trialExpired,
        subscription: currentSubscription,
      });
    } catch (error) {
      recordError(error);
      logger.error("Failed to check billing access", error as Error);
      return err("Failed to check billing access.");
    }
  };

export { createGetOrganizationAccessState };
