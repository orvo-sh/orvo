import { Instrument } from "$lib/instrumentation";
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
import { z } from "zod";

@Instrument({ prefix: "organizationActivation" })
class OrganizationActivationService {
  private logger: Logger;

  constructor(
    private db: DB,
    logger: Logger,
  ) {
    this.logger = logger.child("OrganizationActivationService");
  }

  async createOrganizationActivation(
    input: z.infer<typeof createOrganizationActivationInputSchema>,
  ) {
    this.logger.info("createOrganizationActivation: creating activation", {
      input,
    });

    const validated = createOrganizationActivationInputSchema.safeParse(input);
    if (!validated.success) {
      return err(validated.error.message);
    }

    try {
      await this.db
        .insert(organizationActivation)
        .values({
          organizationId: validated.data.organizationId,
        })
        .onConflictDoNothing({
          target: organizationActivation.organizationId,
        });

      return ok({ id: validated.data.organizationId });
    } catch (error) {
      this.logger.error(
        "createOrganizationActivation: failed to create activation",
        error as Error,
      );
      return err("Failed to create organization activation.");
    }
  }

  async getOrganizationActivation(context: { organizationId: string }) {
    this.logger.info("getOrganizationActivation: getting activation", {
      context,
    });

    try {
      const activation = await this.db.query.organizationActivation.findFirst({
        where: eq(
          organizationActivation.organizationId,
          context.organizationId,
        ),
      });

      if (!activation) {
        return ok({ activation: null });
      }

      const [apps, members, invitations] = await Promise.all([
        this.db.query.app.findMany({
          where: eq(app.organizationId, context.organizationId),
        }),
        this.db.query.member.findMany({
          where: eq(member.organizationId, context.organizationId),
        }),
        this.db.query.invitation.findMany({
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
      this.logger.error(
        "getOrganizationActivation: failed to get activation",
        error as Error,
      );
      return err("Failed to load organization activation.");
    }
  }

  async markTelemetryViewed(context: { organizationId: string }) {
    this.logger.info("markTelemetryViewed: marking telemetry viewed", {
      context,
    });

    try {
      await this.db
        .update(organizationActivation)
        .set({
          hasViewedTelemetry: true,
        })
        .where(
          eq(organizationActivation.organizationId, context.organizationId),
        );

      return ok({ id: context.organizationId });
    } catch (error) {
      this.logger.error(
        "markTelemetryViewed: failed to mark telemetry viewed",
        error as Error,
      );
      return err("Failed to update organization activation.");
    }
  }

  async markFirstAlertCreated(context: { organizationId: string }) {
    this.logger.info("markFirstAlertCreated: marking first alert created", {
      context,
    });

    try {
      await this.db
        .update(organizationActivation)
        .set({
          hasCreatedFirstAlert: true,
        })
        .where(
          eq(organizationActivation.organizationId, context.organizationId),
        );

      return ok({ id: context.organizationId });
    } catch (error) {
      this.logger.error(
        "markFirstAlertCreated: failed to mark first alert created",
        error as Error,
      );
      return err("Failed to update organization activation.");
    }
  }
}

const createOrganizationActivationInputSchema = z.object({
  organizationId: z.string().trim().min(1),
});

export {
  createOrganizationActivationInputSchema,
  OrganizationActivationService,
};
