import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organization } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { eq } from "drizzle-orm";

import { billingStatusHasAccess } from "../shared";

const createGetOrganizationAccessState = ({
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
        where: eq(organization.id, context.organizationId),
      }),
      getCurrentSubscription(context.organizationId),
    ]);

    const billingStatus =
      currentSubscription?.status ?? currentOrganization?.billingStatus;
    const trialExpired =
      currentSubscription?.trialEnd instanceof Date &&
      currentSubscription.trialEnd.getTime() <= Date.now() &&
      billingStatus !== "active";

    return ok({
      hasAccess: billingStatusHasAccess(billingStatus) && !trialExpired,
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
