import { command, getRequestEvent } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { sendTestTelemetryInputSchema } from "$lib/server/services/onboarding.service";
import { err } from "@repo/utils";

export const sendTestTelemetryCommand = command(
  sendTestTelemetryInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.onboardingService.sendTestTelemetry(input, {
      appId: appContext.data.appId,
      userId: event.locals.auth!.user.id,
    });
  },
);
