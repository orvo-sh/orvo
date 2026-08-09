import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { agentEnrollment } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, generateRandomString, ok } from "@repo/utils";
import { createHash } from "node:crypto";
import { z } from "zod";

import { createAgentEnrollmentInputSchema } from "../schema";

const createCreateEnrollment =
  ({
    db,
    logger,
    config,
  }: {
    db: DB;
    logger: Logger;
    config: { cdnBaseUrl: string };
  }) =>
  async (
    input: z.input<typeof createAgentEnrollmentInputSchema>,
    context: { appId: string; userId: string },
  ) => {
    const validated = createAgentEnrollmentInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      const token = `enr_${generateRandomString(48)}`;
      const expiresAt = new Date(Date.now() + 15 * 60_000);

      await db.insert(agentEnrollment).values({
        id: genId("agenr"),
        appId: context.appId,
        displayName: validated.data.displayName,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        environment: validated.data.environment,
        createdBy: context.userId,
        expiresAt,
      });

      return ok({
        expiresAt: expiresAt.toISOString(),
        command: `curl --proto '=https' --tlsv1.2 -fsSL ${new URL("/agent/install.sh", config.cdnBaseUrl)} | sudo sh -s -- --enrollment-token '${token}'`,
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "createEnrollment: failed to create agent enrollment",
        error as Error,
      );
      return err("Failed to create agent enrollment.");
    }
  };

export { createCreateEnrollment };
