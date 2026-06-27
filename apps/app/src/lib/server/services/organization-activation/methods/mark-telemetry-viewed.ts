import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organizationActivation } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { eq } from "drizzle-orm";

const createMarkTelemetryViewed = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  context: { organizationId: string },
) => {
  try {
    await db
      .update(organizationActivation)
      .set({
        hasViewedTelemetry: true,
      })
      .where(
        eq(organizationActivation.organizationId, context.organizationId),
      );

    return ok({ id: context.organizationId });
  } catch (error) {
    recordError(error);
    logger.error("Failed to update organization activation", error as Error);
    return err("Failed to update organization activation.");
  }
};

export { createMarkTelemetryViewed };
