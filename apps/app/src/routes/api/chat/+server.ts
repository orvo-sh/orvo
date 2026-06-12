import { getActiveOrganizationId } from "$lib/server/request-context";
import { error } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

const getStatusForChatError = (message: string) => {
  if (message === "Gemini API key is not configured.") {
    return 503;
  }

  if (message === "App not found.") {
    return 404;
  }

  return 400;
};

export const POST: RequestHandler = async (event) => {
  if (!event.locals.auth) {
    throw error(401, "Sign in to use Ask Orvo.");
  }

  const organizationId = getActiveOrganizationId(event);
  if (!organizationId) {
    throw error(400, "No active organization selected.");
  }

  const body = await event.request.json().catch(() => null);
  const result = await event.locals.container.chatService.streamChat(body, {
    organizationId,
    userId: event.locals.auth.user.id,
  });

  if (!result.success) {
    throw error(getStatusForChatError(result.error), result.error);
  }

  return result.data.response;
};
