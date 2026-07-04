import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { mcpToken } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { and, eq, isNull } from "drizzle-orm";

import { clipText, compareMcpTokenHash } from "./shared";

const createValidateMcpToken =
  ({ db, logger, secret }: { db: DB; logger: Logger; secret: string }) =>
  async (input: {
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) => {
    try {
      const lastUnderscoreIndex = input.token.lastIndexOf("_");

      if (
        lastUnderscoreIndex <= "orvo_mcp_".length ||
        !input.token.startsWith("orvo_mcp_")
      ) {
        return null;
      }

      const tokenPrefix = input.token.slice(0, lastUnderscoreIndex);
      const tokenSecret = input.token.slice(lastUnderscoreIndex + 1);

      if (tokenSecret.length === 0) {
        return null;
      }

      const token = await db.query.mcpToken.findFirst({
        where: and(
          eq(mcpToken.tokenPrefix, tokenPrefix),
          isNull(mcpToken.revokedAt),
        ),
      });

      if (!token) {
        return null;
      }

      if (token.expiresAt && token.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      if (!compareMcpTokenHash(secret, tokenSecret, token.tokenHash)) {
        return null;
      }

      await db
        .update(mcpToken)
        .set({
          lastUsedAt: new Date(),
          lastUsedIp: clipText(input.ipAddress, 255),
          lastUsedUserAgent: clipText(input.userAgent, 500),
          updatedAt: new Date(),
        })
        .where(eq(mcpToken.id, token.id));

      return {
        tokenId: token.id,
        organizationId: token.organizationId,
        scopes: token.scopes,
        allowedAppIds: token.allowedAppIds,
        subjectType: "mcp_token" as const,
        tokenPrefix: token.tokenPrefix,
        tokenName: token.name,
      };
    } catch (error) {
      recordError(error);
      logger.error(
        "validateMcpToken: failed to validate MCP token",
        error as Error,
      );
      return null;
    }
  };

export { createValidateMcpToken };
