import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { chatContext, chatMessage } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getChatInputSchema } from "../schema";
import { sanitizeChatMessagesForClient } from "../tools/presentation";
import { findOwnedChat } from "./shared";

const createGetChat =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof getChatInputSchema>,
    context: { organizationId: string; appId: string; userId: string },
  ) => {
    const validated = getChatInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);

    try {
      const ownedChat = await findOwnedChat(db, validated.data.id, context);
      if (!ownedChat) return err("Chat not found.");

      const [contexts, messages] = await Promise.all([
        db
          .select()
          .from(chatContext)
          .where(eq(chatContext.chatId, ownedChat.id)),
        db
          .select()
          .from(chatMessage)
          .where(eq(chatMessage.chatId, ownedChat.id))
          .orderBy(asc(chatMessage.position)),
      ]);

      return ok({
        chat: { ...ownedChat, contexts },
        messages: sanitizeChatMessagesForClient(
          messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            ...(message.metadata ? { metadata: message.metadata } : {}),
          })) as import("ai").UIMessage[],
        ),
      });
    } catch (error) {
      recordError(error);
      logger.error("getChat: failed to load chat", error as Error);
      return err("Failed to load chat.");
    }
  };

export { createGetChat };
