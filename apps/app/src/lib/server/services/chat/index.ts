import { Instrument } from "$lib/instrumentation";
import type { HeartbeatService } from "$lib/server/services/heartbeat";
import type { IncidentService } from "$lib/server/services/incident";
import type { LogsService } from "$lib/server/services/logs";
import type { MetricsService } from "$lib/server/services/metrics";
import type { TracesService } from "$lib/server/services/traces";
import type { DB } from "@repo/db";
import type { Logger } from "@repo/logger";
import type { LanguageModel } from "ai";
import { z } from "zod";

import { createCreateChat } from "./methods/create-chat";
import { createDeleteChat } from "./methods/delete-chat";
import { createGetChat } from "./methods/get-chat";
import { createListChats } from "./methods/list-chats";
import { createStreamChat } from "./methods/stream-chat";
import {
  createChatInputSchema,
  deleteChatInputSchema,
  getChatInputSchema,
  listChatsInputSchema,
  streamChatInputSchema,
} from "./schema";

@Instrument({ prefix: "chat" })
class ChatService {
  private createChatMethod: ReturnType<typeof createCreateChat>;
  private deleteChatMethod: ReturnType<typeof createDeleteChat>;
  private getChatMethod: ReturnType<typeof createGetChat>;
  private listChatsMethod: ReturnType<typeof createListChats>;
  private streamChatMethod: ReturnType<typeof createStreamChat>;

  constructor(
    db: DB,
    logger: Logger,
    model: LanguageModel | null,
    toolServices: {
      logsService: LogsService;
      tracesService: TracesService;
      metricsService: MetricsService;
      incidentService: IncidentService;
      heartbeatService: HeartbeatService;
    },
  ) {
    const childLogger = logger.child("ChatService");
    this.createChatMethod = createCreateChat({ db, logger: childLogger });
    this.deleteChatMethod = createDeleteChat({ db, logger: childLogger });
    this.getChatMethod = createGetChat({ db, logger: childLogger });
    this.listChatsMethod = createListChats({ db, logger: childLogger });
    this.streamChatMethod = createStreamChat({
      db,
      logger: childLogger,
      model,
      toolServices,
    });
  }

  async createChat(
    input: z.input<typeof createChatInputSchema>,
    context: { organizationId: string; appId: string; userId: string },
  ) {
    return this.createChatMethod(input, context);
  }

  async deleteChat(
    input: z.input<typeof deleteChatInputSchema>,
    context: { organizationId: string; appId: string; userId: string },
  ) {
    return this.deleteChatMethod(input, context);
  }

  async getChat(
    input: z.input<typeof getChatInputSchema>,
    context: { organizationId: string; appId: string; userId: string },
  ) {
    return this.getChatMethod(input, context);
  }

  async listChats(
    input: z.input<typeof listChatsInputSchema>,
    context: { organizationId: string; appId: string; userId: string },
  ) {
    return this.listChatsMethod(input, context);
  }

  async streamChat(
    input: z.input<typeof streamChatInputSchema>,
    context: {
      organizationId: string;
      appId: string;
      userId: string;
      abortSignal?: AbortSignal;
    },
  ) {
    return this.streamChatMethod(input, context);
  }
}

export * from "./schema";
export { ChatService };
