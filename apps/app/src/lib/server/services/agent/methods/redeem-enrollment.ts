import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import {
  agentEnrollment,
  agentInstallation,
  ingestionKey,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { IngestionKeyService } from "../../ingestion-key";
import { redeemAgentEnrollmentInputSchema } from "../schema";

const createRedeemEnrollment =
  ({
    db,
    logger,
    ingestionKeyService,
    config,
  }: {
    db: DB;
    logger: Logger;
    ingestionKeyService: Pick<IngestionKeyService, "createIngestionKey">;
    config: { ingestBaseUrl: string };
  }) =>
  async (input: unknown) => {
    const validated = redeemAgentEnrollmentInputSchema.safeParse(input);
    if (!validated.success) {
      return err("The enrollment request is invalid.");
    }

    try {
      return await db.transaction(async (tx) => {
        const [enrollment] = await tx
          .update(agentEnrollment)
          .set({ redeemedAt: new Date() })
          .where(
            and(
              eq(
                agentEnrollment.tokenHash,
                createHash("sha256").update(validated.data.token).digest("hex"),
              ),
              gt(agentEnrollment.expiresAt, new Date()),
              isNull(agentEnrollment.redeemedAt),
            ),
          )
          .returning();

        if (!enrollment || !enrollment.createdBy) {
          return err(
            "The enrollment token is invalid, expired, or already used.",
          );
        }

        const [existingInstallation] = await tx
          .select()
          .from(agentInstallation)
          .where(
            and(
              eq(agentInstallation.appId, enrollment.appId),
              eq(agentInstallation.hostId, validated.data.hostId),
            ),
          )
          .limit(1);

        const keyResult = await ingestionKeyService.createIngestionKey(
          {
            name: `Orvo agent: ${enrollment.displayName || validated.data.hostName}`.slice(
              0,
              64,
            ),
          },
          { appId: enrollment.appId, userId: enrollment.createdBy },
          tx,
        );
        if (!keyResult.success) {
          tx.rollback();
          return keyResult;
        }

        const agentId = existingInstallation?.id ?? genId("agnt");
        if (existingInstallation) {
          await tx
            .update(ingestionKey)
            .set({ revokedAt: new Date() })
            .where(eq(ingestionKey.id, existingInstallation.ingestionKeyId));
          await tx
            .update(agentInstallation)
            .set({
              ingestionKeyId: keyResult.data.id,
              displayName: enrollment.displayName || validated.data.hostName,
              environment: enrollment.environment,
              hostName: validated.data.hostName,
              operatingSystem: validated.data.operatingSystem,
              architecture: validated.data.architecture,
              agentVersion: validated.data.agentVersion,
              revokedAt: null,
            })
            .where(eq(agentInstallation.id, agentId));
        } else {
          await tx.insert(agentInstallation).values({
            id: agentId,
            appId: enrollment.appId,
            ingestionKeyId: keyResult.data.id,
            displayName: enrollment.displayName || validated.data.hostName,
            environment: enrollment.environment,
            hostId: validated.data.hostId,
            hostName: validated.data.hostName,
            operatingSystem: validated.data.operatingSystem,
            architecture: validated.data.architecture,
            agentVersion: validated.data.agentVersion,
          });
        }

        return ok({
          agentId,
          otlpEndpoint: config.ingestBaseUrl,
          ingestionKey: keyResult.data.key,
          environment: enrollment.environment,
        });
      });
    } catch (error) {
      recordError(error);
      logger.error(
        "redeemEnrollment: failed to redeem agent enrollment",
        error as Error,
      );
      return err("Failed to enroll the agent.");
    }
  };

export { createRedeemEnrollment };
