import { recordError } from "$lib/instrumentation";
import type { DB } from "@repo/db";
import { chat } from "@repo/db/schema";
import type { Logger } from "@repo/logger";
import { err, ok } from "@repo/utils";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { deleteChatInputSchema } from "../schema";
import { findOwnedChat } from "./shared";

const createDeleteChat =
  ({ db, logger }: { db: DB; logger: Logger }) =>
  async (
    input: z.input<typeof deleteChatInputSchema>,
    context: { organizationId: string; appId: string; userId: string },
  ) => {
    const validated = deleteChatInputSchema.safeParse(input);
    if (!validated.success) return err(validated.error.message);

    try {
      const ownedChat = await findOwnedChat(db, validated.data.id, context);
      if (!ownedChat) return err("Chat not found.");

      await db.delete(chat).where(eq(chat.id, ownedChat.id));
      return ok({ id: ownedChat.id });
    } catch (error) {
      recordError(error);
      logger.error("deleteChat: failed to delete chat", error as Error);
      return err("Failed to delete chat.");
    }
  };

export { createDeleteChat };
