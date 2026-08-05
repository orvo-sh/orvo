import { getActiveOrganizationId } from "$lib/server/request-context";
import { streamChatInputSchema } from "$lib/server/services/chat";
import { json, type RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async (event) => {
  const { locals, request } = event;
  const organizationId = getActiveOrganizationId(event);

  if (!locals.auth || !organizationId) {
    return json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("appId" in body) ||
    typeof body.appId !== "string"
  ) {
    return json({ message: "App context is missing." }, { status: 400 });
  }

  const appResult = await locals.container.appService.getApp(
    { id: body.appId },
    { organizationId },
  );
  if (!appResult.success) {
    return json({ message: "App not found." }, { status: 404 });
  }

  const validated = streamChatInputSchema.safeParse(body);
  if (!validated.success) {
    return json({ message: validated.error.message }, { status: 400 });
  }

  return locals.container.chatService.streamChat(validated.data, {
    organizationId,
    appId: body.appId,
    userId: locals.auth.user.id,
    abortSignal: request.signal,
  });
};
