import { recordError } from "$lib/instrumentation";
import type { IncidentService } from "$lib/server/services/incident";
import type { DB } from "@repo/db";
import { notificationDestination } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";

import {
  slackActionValueSchema,
  slackInteractionPayloadSchema,
} from "../schema";

const createProcessAction =
  ({
    db,
    incidentService,
    logger,
  }: {
    db: DB;
    incidentService: Pick<IncidentService, "resolveIncident">;
    logger: Logger;
  }) =>
  async (input: unknown) => {
    const payload = slackInteractionPayloadSchema.safeParse(input);
    if (!payload.success) return err("Invalid Slack interaction.");

    const action = payload.data.actions[0];
    if (action.action_id === "incident_view") {
      return ok({ responseUrl: null });
    }
    if (action.action_id !== "incident_resolve" || !action.value) {
      return err("Unsupported Slack action.");
    }

    const value = slackActionValueSchema.safeParse(
      (() => {
        try {
          return JSON.parse(action.value);
        } catch {
          return null;
        }
      })(),
    );
    if (!value.success) return err("Invalid Slack action.");

    try {
      const destination = await db.query.notificationDestination.findFirst({
        columns: { appId: true },
        where: and(
          eq(notificationDestination.id, value.data.destinationId),
          eq(notificationDestination.kind, "slack"),
          eq(notificationDestination.slackTeamId, payload.data.team.id),
          eq(notificationDestination.isEnabled, true),
        ),
      });

      if (!destination) return err("Slack destination not found.");

      const result = await incidentService.resolveIncident(
        value.data.incidentId,
        {
          appId: destination.appId,
          metadata: {
            manual: true,
            source: "slack",
            slackTeamId: payload.data.team.id,
            slackUserId: payload.data.user.id,
            slackUsername:
              payload.data.user.username ?? payload.data.user.name ?? undefined,
          },
        },
      );

      if (!result.success) return result;
      return ok({ responseUrl: payload.data.response_url ?? null });
    } catch (error) {
      recordError(error);
      logger.error(
        "processAction: failed to process Slack action",
        error as Error,
      );
      return err("Failed to resolve incident.");
    }
  };

export { createProcessAction };
