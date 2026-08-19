import { recordError } from "$lib/instrumentation";
import { and, eq, gt, isNull, lte, or, type DB } from "@repo/db";
import { scoutCreditGrant } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";

const createGetBalance =
  ({
    db,
    logger,
    ensurePlanGrant,
  }: {
    db: DB;
    logger: Logger;
    ensurePlanGrant: (organizationId: string) => Promise<void>;
  }) =>
  async (context: { organizationId: string }) => {
    try {
      await ensurePlanGrant(context.organizationId);

      const now = new Date();
      const grants = await db
        .select({
          source: scoutCreditGrant.source,
          grantedCredits: scoutCreditGrant.grantedCredits,
          remainingCredits: scoutCreditGrant.remainingCredits,
          expiresAt: scoutCreditGrant.expiresAt,
        })
        .from(scoutCreditGrant)
        .where(
          and(
            eq(scoutCreditGrant.organizationId, context.organizationId),
            lte(scoutCreditGrant.validFrom, now),
            or(
              isNull(scoutCreditGrant.expiresAt),
              gt(scoutCreditGrant.expiresAt, now),
            ),
          ),
        );

      return ok({
        included: grants
          .filter((grant) => grant.source === "plan")
          .reduce((total, grant) => total + grant.remainingCredits, 0),
        purchased: grants
          .filter((grant) => grant.source === "purchase")
          .reduce((total, grant) => total + grant.remainingCredits, 0),
        total: grants.reduce(
          (total, grant) => total + grant.remainingCredits,
          0,
        ),
        includedAllowance: grants
          .filter((grant) => grant.source === "plan")
          .reduce((total, grant) => total + grant.grantedCredits, 0),
        periodEnd:
          grants.find((grant) => grant.source === "plan")?.expiresAt ?? null,
      });
    } catch (error) {
      recordError(error);
      logger.error("getBalance: failed to load Scout credits", error as Error);
      return err("Failed to load Scout credits.");
    }
  };

export { createGetBalance };
