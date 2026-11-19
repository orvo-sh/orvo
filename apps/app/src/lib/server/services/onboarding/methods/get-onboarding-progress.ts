import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { onboarding } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { eq } from "drizzle-orm";

const createGetOnboardingProgress =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (context: { userId: string }) => {
    try {
      const milestones = await db
        .select({ milestone: onboarding.milestone })
        .from(onboarding)
        .where(eq(onboarding.userId, context.userId));
      return ok({ milestones: milestones.map((row) => row.milestone) });
    } catch (error) {
      recordError(error);
      logger.error(
        "getOnboardingProgress: failed to get onboarding progress",
        error as Error,
      );
      return err("Failed to get onboarding progress.");
    }
  };

export { createGetOnboardingProgress };
