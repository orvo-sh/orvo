import { recordError } from "$lib/instrumentation";
import type { IncidentService } from "$lib/server/services/incident";
import type { DB } from "@repo/db";
import { notificationDestination, slackEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";

import {
  slackActionValueSchema,
  slackInteractionPayloadSchema,
  slackScoutActionValueSchema,
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
    if (
      action.action_id === "scout_approve" ||
      action.action_id === "scout_reject"
    ) {
      const value = slackScoutActionValueSchema.safeParse(
        (() => {
          try {
            return action.value ? JSON.parse(action.value) : null;
          } catch {
            return null;
          }
        })(),
      );
      if (!value.success) return err("Invalid Scout approval.");
      const destination = await db.query.notificationDestination.findFirst({
        columns: { id: true },
        where: and(
          eq(notificationDestination.appId, value.data.appId),
          eq(notificationDestination.kind, "slack"),
          eq(notificationDestination.slackTeamId, payload.data.team.id),
          eq(notificationDestination.isEnabled, true),
        ),
      });
      if (!destination) return err("Slack integration not found.");
      return ok({
        responseUrl: payload.data.response_url ?? null,
        scoutJob: {
          kind: "approval" as const,
          teamId: payload.data.team.id,
          slackUserId: payload.data.user.id,
          approved: action.action_id === "scout_approve",
          action: value.data,
        },
      });
    }
    if (action.action_id === "scout_investigate" && action.value) {
      const value = slackActionValueSchema.safeParse(
        (() => {
          try {
            return JSON.parse(action.value);
          } catch {
            return null;
          }
        })(),
      );
      if (!value.success || !payload.data.channel || !payload.data.message) {
        return err("Invalid Scout investigation.");
      }
      const destination = await db.query.notificationDestination.findFirst({
        columns: { appId: true, slackBotUserId: true },
        where: and(
          eq(notificationDestination.id, value.data.destinationId),
          eq(notificationDestination.kind, "slack"),
          eq(notificationDestination.slackTeamId, payload.data.team.id),
          eq(notificationDestination.isEnabled, true),
        ),
      });
      if (!destination?.slackBotUserId) {
        return err("Reconnect Slack to use Scout.");
      }
      const eventId = genId("slev");
      await db.insert(slackEvent).values({
        id: eventId,
        teamId: payload.data.team.id,
        eventType: "app_mention",
        payload: {
          type: "event_callback",
          event_id: eventId,
          team_id: payload.data.team.id,
          event: {
            type: "app_mention",
            user: payload.data.user.id,
            text: `<@${destination.slackBotUserId}> Investigate incident ${value.data.incidentId}. Summarize the likely cause and the strongest supporting evidence.`,
            channel: payload.data.channel.id,
            ts: payload.data.message.ts,
            thread_ts: payload.data.message.ts,
          },
        },
      });
      return ok({
        responseUrl: payload.data.response_url ?? null,
        scoutJob: { kind: "message" as const, eventId },
      });
    }
    if (action.action_id === "incident_view") {
      return ok({ responseUrl: null, scoutJob: null });
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
      return ok({
        responseUrl: payload.data.response_url ?? null,
        scoutJob: null,
      });
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
