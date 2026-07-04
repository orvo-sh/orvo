import { recordError } from "$lib/instrumentation";
import { and, eq, isNull, type DB } from "@repo/db";
import { mcpToken } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { desc } from "drizzle-orm";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { listMcpTokensInputSchema } from "../schema";

const createListMcpTokens =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof listMcpTokensInputSchema>,
    context: { organizationId: string },
  ) => {
    logger.info("listMcpTokens: listing MCP tokens", {
      organizationId: context.organizationId,
    });

    const validated = listMcpTokensInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const tokens = await db.query.mcpToken.findMany({
        where: validated.data.includeRevoked
          ? eq(mcpToken.organizationId, context.organizationId)
          : and(
              eq(mcpToken.organizationId, context.organizationId),
              isNull(mcpToken.revokedAt),
            ),
        orderBy: [desc(mcpToken.createdAt)],
      });

      return ok({
        tokens: tokens.map((token) => {
          const { tokenHash, ...rest } = token;
          void tokenHash;
          return rest;
        }),
      });
    } catch (error) {
      recordError(error);
      logger.error("listMcpTokens: failed to list MCP tokens", error as Error);
      return err("Failed to list MCP tokens.");
    }
  };

export { createListMcpTokens };
