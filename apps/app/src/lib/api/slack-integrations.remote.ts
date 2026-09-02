import { command, getRequestEvent } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { err } from "@repo/utils";
import { z } from "zod";

export const testSlackIntegrationCommand = command(z.object({}), async () => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);
  if (!appContext.success) return err(appContext.error);

  return event.locals.container.slackIntegrationService.testIntegration({
    appId: appContext.data.appId,
  });
});

export const disconnectSlackIntegrationCommand = command(
  z.object({}),
  async () => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);
    if (!appContext.success) return err(appContext.error);

    return event.locals.container.slackIntegrationService.disconnectIntegration(
      {
        appId: appContext.data.appId,
      },
    );
  },
);
