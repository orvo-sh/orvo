import { command, getRequestEvent } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { createAgentEnrollmentInputSchema } from "$lib/server/services/agent";
import { err } from "@repo/utils";

export const createAgentEnrollmentCommand = command(
  createAgentEnrollmentInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.agentService.createEnrollment(input, {
      appId: appContext.data.appId,
      userId: event.locals.auth!.user.id,
    });
  },
);
