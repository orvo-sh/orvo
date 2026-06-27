import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organizationActivation } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { createOrganizationActivationInputSchema } from "../schema";

const createCreateOrganizationActivation = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  input: z.input<typeof createOrganizationActivationInputSchema>,
) => {
  const validated = createOrganizationActivationInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    await db
      .insert(organizationActivation)
      .values({
        organizationId: validated.data.organizationId,
      })
      .onConflictDoNothing({
        target: organizationActivation.organizationId,
      });

    return ok({ id: validated.data.organizationId });
  } catch (error) {
    recordError(error);
    logger.error("Failed to create organization activation", error as Error);
    return err("Failed to create organization activation.");
  }
};

export { createCreateOrganizationActivation };
