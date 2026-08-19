import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";

const createGetBillingState = ({
  db,
  logger,
  getCurrentSubscription,
}: {
  db: DB;
  logger: Logger;
  getCurrentSubscription: (organizationId: string) => Promise<any>;
}) => async (context: { organizationId: string }) => {
  try {
    const [currentOrganization, currentSubscription] = await Promise.all([
      db.query.organization.findFirst({
        columns: {
          billingPlan: true,
          billingStatus: true,
        },
        with: {
          usage: {
            columns: {
              createdAt: false,
              id: false,
              organizationId: false,
              updatedAt: false,
            },
          },
        },
        where: ({ id }, { eq }) => eq(id, context.organizationId),
      }),
      getCurrentSubscription(context.organizationId),
    ]);

    if (!currentOrganization) {
      return err("No organization found.");
    }

    return ok({
      billingPlan: currentOrganization.billingPlan,
      billingStatus:
        currentSubscription?.status ?? currentOrganization.billingStatus,
      trialStart: currentSubscription?.trialStart ?? null,
      trialEnd: currentSubscription?.trialEnd ?? null,
      ...currentOrganization.usage,
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to get billing state", error as Error);
    return err("Failed to get billing state");
  }
};

export { createGetBillingState };
