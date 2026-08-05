import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { chat, chatContext } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, genId, ok } from "@repo/utils";
import { z } from "zod";

import { createChatInputSchema } from "../schema";

const createCreateChat =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof createChatInputSchema>,
    context: { organizationId: string; appId: string; userId: string },
  ) => {
    const validated = createChatInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);

    try {
      const id = genId("chat");

      await db.transaction(async (tx) => {
        await tx.insert(chat).values({
          id,
          organizationId: context.organizationId,
          appId: context.appId,
          title: validated.data.title ?? "New chat",
          createdBy: context.userId,
          updatedBy: context.userId,
        });

        if (validated.data.context) {
          await tx.insert(chatContext).values({
            id: genId("chatctx"),
            chatId: id,
            ...validated.data.context,
          });
        }
      });

      return ok({ id });
    } catch (error) {
      recordError(error);
      logger.error("createChat: failed to create chat", error as Error);
      return err("Failed to create chat.");
    }
  };

export { createCreateChat };
