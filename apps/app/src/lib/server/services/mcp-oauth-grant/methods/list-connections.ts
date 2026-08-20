import { recordError } from "$lib/instrumentation";
import { and, desc, eq, type DB } from "@repo/db";
import { mcpOauthGrant, oauthClient } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { listMcpConnectionsInputSchema } from "../schema";

const createListConnections =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof listMcpConnectionsInputSchema>,
    context: { userId: string; organizationId: string },
  ) => {
    const validated = listMcpConnectionsInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const connections = await db
        .select({
          id: mcpOauthGrant.id,
          name: oauthClient.name,
          connectedAt: mcpOauthGrant.updatedAt,
        })
        .from(mcpOauthGrant)
        .innerJoin(
          oauthClient,
          eq(oauthClient.clientId, mcpOauthGrant.clientId),
        )
        .where(
          and(
            eq(mcpOauthGrant.userId, context.userId),
            eq(mcpOauthGrant.organizationId, context.organizationId),
          ),
        )
        .orderBy(desc(mcpOauthGrant.updatedAt));

      return ok({
        connections: connections.map((connection) => ({
          ...connection,
          name: connection.name || "MCP client",
        })),
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "listConnections: failed to list MCP connections",
        error as Error,
      );
      return err("Failed to list MCP connections.");
    }
  };

export { createListConnections };
