import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import {
  notificationDestination,
  slackEvent,
  slackScoutThread,
} from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, eq } from "drizzle-orm";

import { slackEventCallbackSchema } from "../schema";

const createIngestEvent =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (input: unknown) => {
    const parsed = slackEventCallbackSchema.safeParse(input);
    if (!parsed.success) return ok({ queued: false, eventId: "" });
    if (parsed.data.event.bot_id || parsed.data.event.subtype) {
      return ok({ queued: false, eventId: parsed.data.event_id });
    }

    try {
      if (parsed.data.event.type === "message") {
        const isDirectMessage =
          parsed.data.event.channel_type === "im" ||
          parsed.data.event.channel.startsWith("D");

        if (!isDirectMessage) {
          if (!parsed.data.event.thread_ts) {
            return ok({ queued: false, eventId: parsed.data.event_id });
          }

          const [thread, destinations] = await Promise.all([
            db.query.slackScoutThread.findFirst({
              columns: { id: true },
              where: and(
                eq(slackScoutThread.teamId, parsed.data.team_id),
                eq(slackScoutThread.channelId, parsed.data.event.channel),
                eq(slackScoutThread.threadTs, parsed.data.event.thread_ts),
              ),
            }),
            db.query.notificationDestination.findMany({
              columns: { slackBotUserId: true },
              where: and(
                eq(notificationDestination.kind, "slack"),
                eq(notificationDestination.slackTeamId, parsed.data.team_id),
              ),
            }),
          ]);

          if (
            !thread ||
            destinations.some(
              ({ slackBotUserId }) =>
                slackBotUserId &&
                parsed.data.event.text.includes(`<@${slackBotUserId}>`),
            )
          ) {
            return ok({ queued: false, eventId: parsed.data.event_id });
          }
        }
      }

      const inserted = await db
        .insert(slackEvent)
        .values({
          id: parsed.data.event_id,
          teamId: parsed.data.team_id,
          eventType: parsed.data.event.type,
          payload: parsed.data as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing()
        .returning({ id: slackEvent.id });

      const existing = inserted.length
        ? null
        : await db.query.slackEvent.findFirst({
            columns: { processedAt: true },
            where: (table, { eq }) => eq(table.id, parsed.data.event_id),
          });
      return ok({
        queued: inserted.length > 0 || existing?.processedAt === null,
        eventId: parsed.data.event_id,
      });
    } catch (error) {
      recordError(error);
      logger.error("ingestEvent: failed to store Slack event", error as Error);
      return err("Failed to accept Slack event.");
    }
  };

export { createIngestEvent };
