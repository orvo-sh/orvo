import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { app, mcpToken } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { count, inArray } from "drizzle-orm";
import { z } from "zod";

import { createMcpTokenInputSchema } from "../schema";
import { createMcpTokenHash, createMcpTokenSecret } from "./shared";

const createCreateMcpToken =
  ({ db, logger, secret }: { db: DB; logger: Logger; secret: string }) =>
  async (
    input: z.input<typeof createMcpTokenInputSchema>,
    context: { organizationId: string; userId: string },
  ) => {
    logger.info("createMcpToken: creating MCP token", {
      organizationId: context.organizationId,
      userId: context.userId,
    });

    const validated = createMcpTokenInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const allowedApps = await db
        .select({ total: count() })
        .from(app)
        .where(
          and(
            eq(app.organizationId, context.organizationId),
            inArray(app.id, validated.data.allowedAppIds),
          ),
        );

      if (
        Number(allowedApps[0]?.total ?? 0) !==
        validated.data.allowedAppIds.length
      ) {
        return err("Choose valid apps from this organization.");
      }

      const id = genId("mcpt");
      const tokenSecret = createMcpTokenSecret();
      const tokenPrefix = `orvo_mcp_${id}`;
      const token = `${tokenPrefix}_${tokenSecret}`;
      const expiresAt =
        validated.data.expiresInDays === null
          ? null
          : new Date(
              Date.now() + validated.data.expiresInDays * 24 * 60 * 60 * 1000,
            );

      await db.insert(mcpToken).values({
        id,
        organizationId: context.organizationId,
        name: validated.data.name,
        description: validated.data.description,
        tokenPrefix,
        tokenHash: createMcpTokenHash(secret, tokenSecret),
        scopes: validated.data.scopes,
        allowedAppIds: validated.data.allowedAppIds,
        createdBy: context.userId,
        expiresAt,
      });

      return ok({
        id,
        token,
        tokenPrefix,
        name: validated.data.name,
        description: validated.data.description,
        scopes: validated.data.scopes,
        allowedAppIds: validated.data.allowedAppIds,
        expiresAt,
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "createMcpToken: failed to create MCP token",
        error as Error,
      );
      return err("Failed to create MCP token.");
    }
  };

export { createCreateMcpToken };
