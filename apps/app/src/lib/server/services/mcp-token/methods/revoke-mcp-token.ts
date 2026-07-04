import { recordError } from "$lib/instrumentation";
import { and, eq, isNull, type DB } from "@repo/db";
import { mcpToken } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { revokeMcpTokenInputSchema } from "../schema";

const createRevokeMcpToken =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof revokeMcpTokenInputSchema>,
    context: { organizationId: string },
  ) => {
    logger.info("revokeMcpToken: revoking MCP token", {
      organizationId: context.organizationId,
    });

    const validated = revokeMcpTokenInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const [token] = await db
        .update(mcpToken)
        .set({
          revokedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mcpToken.id, validated.data.id),
            eq(mcpToken.organizationId, context.organizationId),
            isNull(mcpToken.revokedAt),
          ),
        )
        .returning();

      if (!token) {
        return err("MCP token not found.");
      }

      return ok(undefined);
    } catch (error) {
      recordError(error);
      logger.error(
        "revokeMcpToken: failed to revoke MCP token",
        error as Error,
      );
      return err("Failed to revoke MCP token.");
    }
  };

export { createRevokeMcpToken };
