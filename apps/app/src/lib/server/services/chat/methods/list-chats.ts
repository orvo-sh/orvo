import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { chat, chatContext } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { listChatsInputSchema } from "../schema";

const createListChats =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof listChatsInputSchema>,
    context: { organizationId: string; appId: string; userId: string },
  ) => {
    const validated = listChatsInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);

    try {
      const chats = await db
        .select()
        .from(chat)
        .where(
          and(
            eq(chat.organizationId, context.organizationId),
            eq(chat.appId, context.appId),
            eq(chat.createdBy, context.userId),
          ),
        )
        .orderBy(desc(chat.updatedAt))
        .limit(validated.data.limit);
      const contexts = chats.length
        ? await db
            .select()
            .from(chatContext)
            .where(
              inArray(
                chatContext.chatId,
                chats.map((item) => item.id),
              ),
            )
        : [];

      return ok({
        chats: chats.map((item) => ({
          ...item,
          contexts: contexts.filter((context) => context.chatId === item.id),
        })),
      });
    } catch (error) {
      recordError(error);
      logger.error("listChats: failed to list chats", error as Error);
      return err("Failed to load chats.");
    }
  };

export { createListChats };
