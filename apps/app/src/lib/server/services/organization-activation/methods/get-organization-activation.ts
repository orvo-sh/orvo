import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import {
  app,
  invitation,
  member,
  organizationActivation,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { eq } from "drizzle-orm";

const createGetOrganizationActivation = ({
  db,
  logger,
}: {
  db: DB;
  logger: Logger;
}) => async (
  context: { organizationId: string },
) => {
  try {
    const activation = await db.query.organizationActivation.findFirst({
      where: eq(
        organizationActivation.organizationId,
        context.organizationId,
      ),
    });

    if (!activation) {
      return ok({ activation: null });
    }

    const [apps, members, invitations] = await Promise.all([
      db.query.app.findMany({
        where: eq(app.organizationId, context.organizationId),
      }),
      db.query.member.findMany({
        where: eq(member.organizationId, context.organizationId),
      }),
      db.query.invitation.findMany({
        where: eq(invitation.organizationId, context.organizationId),
      }),
    ]);

    const hasCreatedFirstApp = apps.length > 0;
    const hasSentFirstSignals = apps.some(
      (currentApp) =>
        !!currentApp.logsFirstReceivedAt ||
        !!currentApp.tracesFirstReceivedAt ||
        !!currentApp.metricsFirstReceivedAt,
    );
    const hasInvitedTeammate = members.length > 1 || invitations.length > 0;
    const completedCount = [
      hasCreatedFirstApp,
      hasSentFirstSignals,
      activation.hasViewedTelemetry,
      activation.hasCreatedFirstAlert,
      hasInvitedTeammate,
    ].filter(Boolean).length;

    return ok({
      activation: {
        hasCreatedFirstApp,
        hasSentFirstSignals,
        hasViewedTelemetry: activation.hasViewedTelemetry,
        hasCreatedFirstAlert: activation.hasCreatedFirstAlert,
        hasInvitedTeammate,
        completedCount,
        totalCount: 5,
      },
    });
  } catch (error) {
    recordError(error);
    logger.error("Failed to load organization activation", error as Error);
    return err("Failed to load organization activation.");
  }
};

export { createGetOrganizationActivation };
