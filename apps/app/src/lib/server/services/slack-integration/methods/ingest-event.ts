import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { slackEvent } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";

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
