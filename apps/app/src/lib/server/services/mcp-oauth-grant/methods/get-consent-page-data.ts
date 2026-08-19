import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { mcpOauthGrant, oauthClient } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { mcpOauthClientInputSchema } from "../schema";

const createGetConsentPageData =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof mcpOauthClientInputSchema>,
    context: { userId: string },
  ) => {
    const validated = mcpOauthClientInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);

    try {
      const [client, grant] = await Promise.all([
        db.query.oauthClient.findFirst({
          where: eq(oauthClient.clientId, validated.data.clientId),
        }),
        db.query.mcpOauthGrant.findFirst({
          where: and(
            eq(mcpOauthGrant.clientId, validated.data.clientId),
            eq(mcpOauthGrant.userId, context.userId),
          ),
        }),
      ]);

      if (!client) return err("OAuth client not found.");

      return ok({
        client: {
          id: client.clientId,
          name: client.name || "MCP client",
        },
        organizationId: grant?.organizationId ?? null,
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "getConsentPageData: failed to load MCP consent data",
        error as Error,
      );
      return err("Failed to load the authorization request.");
    }
  };

export { createGetConsentPageData };
