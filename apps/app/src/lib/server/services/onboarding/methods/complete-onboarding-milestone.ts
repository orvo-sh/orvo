import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { onboarding } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { z } from "zod";
import { completeOnboardingMilestoneInputSchema } from "../schema";

const createCompleteOnboardingMilestone =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof completeOnboardingMilestoneInputSchema>,
    context: { userId: string },
  ) => {
    const validated = completeOnboardingMilestoneInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);
    try {
      await db
        .insert(onboarding)
        .values({ userId: context.userId, milestone: validated.data.milestone })
        .onConflictDoNothing();
      return ok(undefined);
    } catch (error) {
      recordError(error);
      logger.error(
        "completeOnboardingMilestone: failed to complete onboarding milestone",
        error as Error,
      );
      return err("Failed to save onboarding progress.");
    }
  };

export { createCompleteOnboardingMilestone };
