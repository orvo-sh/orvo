import { recordError } from "$lib/instrumentation";
import { and, eq, gt, isNull, lte, or, sql, type DB } from "@repo/db";
import {
  scoutCreditGrant,
  scoutUsage,
  scoutUsageAllocation,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";

import {
  allocateScoutCredits,
  calculateScoutCredits,
  SCOUT_CREDIT_POLICY_VERSION,
} from "./shared";

const createRecordUsage =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (input: {
    operationId: string;
    organizationId: string;
    appId: string;
    chatId: string;
    userId: string;
    model: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    reasoningTokens?: number | null;
    totalTokens?: number | null;
  }) => {
    const inputTokens = Math.max(0, Math.ceil(input.inputTokens ?? 0));
    const outputTokens = Math.max(0, Math.ceil(input.outputTokens ?? 0));
    const reasoningTokens = Math.max(0, Math.ceil(input.reasoningTokens ?? 0));
    const totalTokens = Math.max(
      0,
      Math.ceil(input.totalTokens ?? inputTokens + outputTokens),
    );
    const credits = calculateScoutCredits({
      inputTokens,
      outputTokens,
      totalTokens,
    });

    try {
      return await db.transaction(async (tx) => {
        const usageId = genId("scoutu");
        const inserted = await tx
          .insert(scoutUsage)
          .values({
            id: usageId,
            operationId: input.operationId,
            organizationId: input.organizationId,
            appId: input.appId,
            chatId: input.chatId,
            userId: input.userId,
            model: input.model,
            policyVersion: SCOUT_CREDIT_POLICY_VERSION,
            inputTokens,
            outputTokens,
            reasoningTokens,
            totalTokens,
            credits,
          })
          .onConflictDoNothing({ target: scoutUsage.operationId })
          .returning({ id: scoutUsage.id });

        if (!inserted.length) {
          const existing = await tx.query.scoutUsage.findFirst({
            columns: {
              credits: true,
              totalTokens: true,
              unfundedCredits: true,
            },
            where: eq(scoutUsage.operationId, input.operationId),
          });

          return existing ? ok(existing) : err("Failed to record Scout usage.");
        }

        const now = new Date();
        const grants = await tx
          .select()
          .from(scoutCreditGrant)
          .where(
            and(
              eq(scoutCreditGrant.organizationId, input.organizationId),
              gt(scoutCreditGrant.remainingCredits, 0),
              lte(scoutCreditGrant.validFrom, now),
              or(
                isNull(scoutCreditGrant.expiresAt),
                gt(scoutCreditGrant.expiresAt, now),
              ),
            ),
          )
          .orderBy(
            sql`${scoutCreditGrant.expiresAt} asc nulls last`,
            scoutCreditGrant.createdAt,
          )
          .for("update");

        const { allocations, unfundedCredits } = allocateScoutCredits(
          grants,
          credits,
        );
        for (const allocation of allocations) {
          await tx
            .update(scoutCreditGrant)
            .set({
              remainingCredits: sql`${scoutCreditGrant.remainingCredits} - ${allocation.credits}`,
              updatedAt: new Date(),
            })
            .where(eq(scoutCreditGrant.id, allocation.grantId));
          await tx.insert(scoutUsageAllocation).values({
            usageId,
            grantId: allocation.grantId,
            credits: allocation.credits,
          });
        }

        if (unfundedCredits > 0) {
          await tx
            .update(scoutUsage)
            .set({ unfundedCredits })
            .where(eq(scoutUsage.id, usageId));
        }

        return ok({
          credits,
          totalTokens,
          unfundedCredits,
        });
      });
    } catch (error) {
      recordError(error);
      logger.error("recordUsage: failed to record Scout usage", error as Error);
      return err("Failed to record Scout usage.");
    }
  };

export { createRecordUsage };
