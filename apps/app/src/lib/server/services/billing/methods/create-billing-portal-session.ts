import { recordError } from "$lib/instrumentation";
import type { Auth } from "$lib/server/auth";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { createBillingPortalInputSchema } from "../schema";
import { readRedirectUrl } from "../shared";

const createCreateBillingPortalSession = ({
  logger,
  isOrganizationOwner,
}: {
  logger: Logger;
  isOrganizationOwner: (organizationId: string, userId: string) => Promise<boolean>;
}) => async (
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
    if (!(await isOrganizationOwner(context.organizationId, context.userId))) {
      return err("Only organization owners can manage billing.");
    }

    const returnUrl = new URL("/settings/billing", context.origin).toString();
    const result = await (context.authService.api as any).createBillingPortal({
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
