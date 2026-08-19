import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { mcpOauthGrant, member } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

import { upsertMcpOauthGrantInputSchema } from "../schema";

const createUpsertGrant =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof upsertMcpOauthGrantInputSchema>,
    context: { userId: string },
  ) => {
    const validated = upsertMcpOauthGrantInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);

    try {
      const currentMember = await db.query.member.findFirst({
        where: and(
          eq(member.organizationId, validated.data.organizationId),
          eq(member.userId, context.userId),
        ),
      });
      if (!currentMember)
        return err("You do not have access to that organization.");

      const existing = await db.query.mcpOauthGrant.findFirst({
        where: and(
          eq(mcpOauthGrant.clientId, validated.data.clientId),
          eq(mcpOauthGrant.userId, context.userId),
        ),
      });

      if (existing) {
        await db
          .update(mcpOauthGrant)
          .set({
            organizationId: validated.data.organizationId,
            updatedAt: new Date(),
          })
          .where(eq(mcpOauthGrant.id, existing.id));
        return ok({ id: existing.id });
      }

      const id = genId("mcpg");
      await db.insert(mcpOauthGrant).values({
        id,
        clientId: validated.data.clientId,
        userId: context.userId,
        organizationId: validated.data.organizationId,
      });
      return ok({ id });
    } catch (error) {
      recordError(error);
      logger.error("upsertGrant: failed to save MCP grant", error as Error);
      return err("Failed to authorize the organization.");
    }
  };

export { createUpsertGrant };
