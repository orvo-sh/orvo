import { command, getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import {
  createChatInputSchema,
  deleteChatInputSchema,
  getChatInputSchema,
  listChatsInputSchema,
} from "$lib/server/services/chat";
import { err } from "@repo/utils";

const getContext = async () => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);
  if (!appContext.success || !event.locals.auth) return null;

  return {
    event,
    context: {
      organizationId: appContext.data.organizationId,
      appId: appContext.data.appId,
      userId: event.locals.auth.user.id,
    },
  };
};

const listChatsQuery = query(listChatsInputSchema, async (input) => {
  const request = await getContext();
  if (!request) return err("App context is missing.");
  return request.event.locals.container.chatService.listChats(
    input,
    request.context,
  );
});

const getChatQuery = query(getChatInputSchema, async (input) => {
  const request = await getContext();
  if (!request) return err("App context is missing.");
  return request.event.locals.container.chatService.getChat(
    input,
    request.context,
  );
});

const createChatCommand = command(createChatInputSchema, async (input) => {
  const request = await getContext();
  if (!request) return err("App context is missing.");
  return request.event.locals.container.chatService.createChat(
    input,
    request.context,
  );
});

const deleteChatCommand = command(deleteChatInputSchema, async (input) => {
  const request = await getContext();
  if (!request) return err("App context is missing.");
  return request.event.locals.container.chatService.deleteChat(
    input,
    request.context,
  );
});

export { createChatCommand, deleteChatCommand, getChatQuery, listChatsQuery };
