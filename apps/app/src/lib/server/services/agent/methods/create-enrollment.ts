import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { agentEnrollment } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, generateRandomString, ok } from "@repo/utils";
import { createHash } from "node:crypto";
import { z } from "zod";

import { createAgentEnrollmentInputSchema } from "../schema";
import { agentVersion } from "../version";

const createCreateEnrollment =
  ({ db, logger }: { db: DB; logger: Logger }) =>
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

      logger.info("createEnrollment: agent enrollment created", {
        appId: context.appId,
        userId: context.userId,
        environment: validated.data.environment,
        expiresAt: expiresAt.toISOString(),
      });

      return ok({
        expiresAt: expiresAt.toISOString(),
        command: `curl --proto '=https' --tlsv1.2 -fsSL https://github.com/orvo-sh/orvo/releases/download/agent-v${agentVersion}/install.sh | sudo sh -s -- --version ${agentVersion} --enrollment-token '${token}'`,
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
