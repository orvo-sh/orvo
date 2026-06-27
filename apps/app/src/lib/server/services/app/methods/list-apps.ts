import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { app } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { asc, eq } from "drizzle-orm";

const createListApps = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  context: { organizationId: string },
) => {
  try {
    const apps = await db.query.app.findMany({
      where: eq(app.organizationId, context.organizationId),
      orderBy: [asc(app.createdAt), asc(app.name)],
    });

    return ok({ apps });
  } catch (error) {
    recordError(error);
    logger.error("Failed to load apps", error as Error);
    return err("Failed to load apps.");
  }
};

export { createListApps };
