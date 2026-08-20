import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { organization, organizationUsage } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { updateOverageSettingsInputSchema } from "../schema";

const createUpdateOverageSettings =
  ({
    db,
    logger,
    isOrganizationOwner,
  }: {
    db: DB;
    logger: Logger;
    isOrganizationOwner: (
      organizationId: string,
      userId: string,
    ) => Promise<boolean>;
  }) =>
  async (
    input: z.input<typeof updateOverageSettingsInputSchema>,
    context: { organizationId: string; userId: string },
  ) => {
    const validated = updateOverageSettingsInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);

    try {
      if (
        !(await isOrganizationOwner(context.organizationId, context.userId))
      ) {
        return err("Only organization owners can manage overages.");
      }

      const currentOrganization = await db.query.organization.findFirst({
        columns: { billingPlan: true, billingStatus: true },
        where: eq(organization.id, context.organizationId),
      });
      if (
        currentOrganization?.billingPlan !== "pro" ||
        currentOrganization.billingStatus !== "active"
      ) {
        return err(
          "Overages can only be enabled for an active Pro subscription.",
        );
      }

      const [updated] = await db
        .update(organizationUsage)
        .set(validated.data)
        .where(eq(organizationUsage.organizationId, context.organizationId))
        .returning({ id: organizationUsage.id });
      if (!updated) return err("Organization usage was not found.");

      return ok(null);
    } catch (error) {
      recordError(error);
      logger.error(
        "updateOverageSettings: failed to update overage settings",
        error as Error,
      );
      return err("Failed to update overage settings.");
    }
  };

export { createUpdateOverageSettings };
