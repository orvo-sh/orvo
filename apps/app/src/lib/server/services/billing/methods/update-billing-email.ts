import { recordError } from "$lib/instrumentation";
import type { Logger } from "@repo/logger";
import { err } from "@repo/utils";
import { z } from "zod";

import { updateBillingEmailInputSchema } from "../schema";

const createUpdateBillingEmail = ({
  logger,
  isOrganizationOwner,
}: {
  logger: Logger;
  isOrganizationOwner: (organizationId: string, userId: string) => Promise<boolean>;
}) => async (
  input: z.input<typeof updateBillingEmailInputSchema>,
  context: { organizationId: string; userId: string },
) => {
  const validated = updateBillingEmailInputSchema.safeParse(input);
  if (!validated.success) {
    return err(validated.error.message);
  }

  try {
    if (!(await isOrganizationOwner(context.organizationId, context.userId))) {
      return err("Only organization owners can manage billing.");
    }

    return err("Billing email updates are not available yet.");
  } catch (error) {
    recordError(error);
    logger.error("Failed to update billing email", error as Error);
    return err("Failed to update billing email.");
  }
};

export { createUpdateBillingEmail };
