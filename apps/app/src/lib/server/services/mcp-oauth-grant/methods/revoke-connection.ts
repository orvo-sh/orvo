import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import {
  mcpOauthGrant,
  oauthAccessToken,
  oauthConsent,
  oauthRefreshToken,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { revokeMcpConnectionInputSchema } from "../schema";

const createRevokeConnection =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof revokeMcpConnectionInputSchema>,
    context: { userId: string; organizationId: string },
  ) => {
    const validated = revokeMcpConnectionInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const [grant] = await db
        .select({
          id: mcpOauthGrant.id,
          clientId: mcpOauthGrant.clientId,
        })
        .from(mcpOauthGrant)
        .where(
          and(
            eq(mcpOauthGrant.id, validated.data.id),
            eq(mcpOauthGrant.userId, context.userId),
            eq(mcpOauthGrant.organizationId, context.organizationId),
          ),
        )
        .limit(1);

      if (!grant) {
        return err("MCP connection not found.");
      }

      await db.transaction(async (tx) => {
        const tokenScope = and(
          eq(oauthAccessToken.clientId, grant.clientId),
          eq(oauthAccessToken.userId, context.userId),
          eq(oauthAccessToken.referenceId, context.organizationId),
        );
        await tx.delete(oauthAccessToken).where(tokenScope);
        await tx
          .delete(oauthRefreshToken)
          .where(
            and(
              eq(oauthRefreshToken.clientId, grant.clientId),
              eq(oauthRefreshToken.userId, context.userId),
              eq(oauthRefreshToken.referenceId, context.organizationId),
            ),
          );
        await tx
          .delete(oauthConsent)
          .where(
            and(
              eq(oauthConsent.clientId, grant.clientId),
              eq(oauthConsent.userId, context.userId),
              eq(oauthConsent.referenceId, context.organizationId),
            ),
          );
        await tx
          .delete(mcpOauthGrant)
          .where(
            and(
              eq(mcpOauthGrant.id, grant.id),
              eq(mcpOauthGrant.userId, context.userId),
              eq(mcpOauthGrant.organizationId, context.organizationId),
            ),
          );
      });

      return ok({ id: grant.id });
    } catch (error) {
      recordError(error);
      logger.error(
        "revokeConnection: failed to revoke MCP connection",
        error as Error,
      );
      return err("Failed to revoke MCP connection.");
    }
  };

export { createRevokeConnection };
