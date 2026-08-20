import { recordError } from "$lib/instrumentation";
import { eq, sql, type DB } from "@repo/db";
import { organizationUsage } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";

import { calculateChatCredits } from "./shared";

const createRecordUsage =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: {
      inputTokens?: number | null;
      outputTokens?: number | null;
      totalTokens?: number | null;
    },
    context: { organizationId: string },
  ) => {
    const inputTokens = Math.max(0, Math.ceil(input.inputTokens ?? 0));
    const outputTokens = Math.max(0, Math.ceil(input.outputTokens ?? 0));
    const totalTokens = Math.max(
      0,
      Math.ceil(input.totalTokens ?? inputTokens + outputTokens),
    );
    const credits = calculateChatCredits({
      inputTokens,
      outputTokens,
      totalTokens,
    });

    try {
      const result = await db
        .update(organizationUsage)
        .set({
          chatCreditsUsed: sql`${organizationUsage.chatCreditsUsed} + ${credits}`,
        })
        .where(eq(organizationUsage.organizationId, context.organizationId))
        .returning({ chatCreditsUsed: organizationUsage.chatCreditsUsed });

      if (!result.length) {
        return err("Failed to record chat usage.");
      }

      return ok({ credits, totalTokens });
    } catch (error) {
      recordError(error);
      logger.error("recordUsage: failed to record chat usage", error as Error);
      return err("Failed to record chat usage.");
    }
  };

export { createRecordUsage };
