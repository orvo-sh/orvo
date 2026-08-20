import { recordError } from "$lib/instrumentation";
import type { Auth } from "$lib/server/auth";
import type { DB } from "@repo/db";
import { app } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { createBillingPortalInputSchema } from "../schema";
import { readRedirectUrl } from "../shared";

const createCreateBillingPortalSession =
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
    input: z.input<typeof createBillingPortalInputSchema>,
    context: {
      organizationId: string;
      userId: string;
      headers: Headers;
      origin: string;
      authService: Auth;
    },
  ) => {
    const validated = createBillingPortalInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      if (
        !(await isOrganizationOwner(context.organizationId, context.userId))
      ) {
        return err("Only organization owners can manage billing.");
      }

      const currentApp = await db.query.app.findFirst({
        columns: { id: true },
        where: and(
          eq(app.id, validated.data.appId),
          eq(app.organizationId, context.organizationId),
        ),
      });
      if (!currentApp) {
        return err("App not found.");
      }

      const returnUrl = new URL(
        `/a/${currentApp.id}/settings/billing`,
        context.origin,
      ).toString();
      const result = await context.authService.api.createBillingPortal({
        body: {
          customerType: "organization",
          referenceId: context.organizationId,
          returnUrl,
          disableRedirect: true,
        },
        headers: context.headers,
      });

      const portalUrl = readRedirectUrl(result);
      if (!portalUrl) {
        return err("Failed to open billing management.");
      }

      return ok({ url: portalUrl });
    } catch (error) {
      recordError(error);
      logger.error("Failed to create billing portal session", error as Error);
      return err("Failed to open billing management.");
    }
  };

export { createCreateBillingPortalSession };
