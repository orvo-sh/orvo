import { recordError } from "$lib/instrumentation";
import { and, eq, type DB } from "@repo/db";
import { mcpOauthGrant, member } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";

import { mcpOauthClientInputSchema } from "../schema";

const createResolveGrant =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof mcpOauthClientInputSchema>,
    context: { userId: string },
  ) => {
    const validated = mcpOauthClientInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);

    try {
      const grant = await db.query.mcpOauthGrant.findFirst({
        where: and(
          eq(mcpOauthGrant.clientId, validated.data.clientId),
          eq(mcpOauthGrant.userId, context.userId),
        ),
      });
      if (!grant) return err("MCP authorization not found.");

      const currentMember = await db.query.member.findFirst({
        where: and(
          eq(member.organizationId, grant.organizationId),
          eq(member.userId, context.userId),
        ),
      });
      if (!currentMember) return err("MCP authorization is no longer valid.");

      return ok({ organizationId: grant.organizationId });
    } catch (error) {
      recordError(error);
      logger.error("resolveGrant: failed to resolve MCP grant", error as Error);
      return err("Failed to validate MCP authorization.");
    }
  };

export { createResolveGrant };
