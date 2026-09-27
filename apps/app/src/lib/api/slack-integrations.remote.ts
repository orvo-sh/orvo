import { command, getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { updateSlackChannelInputSchema } from "$lib/server/services/slack-integration";
import { err } from "@repo/utils";
import { z } from "zod";

export const getSlackChannelsQuery = query(z.object({}), async () => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);
  if (!appContext.success) return err(appContext.error);

  return event.locals.container.slackIntegrationService.listChannels({
    appId: appContext.data.appId,
  });
});

export const updateSlackChannelCommand = command(
  updateSlackChannelInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);
    if (!appContext.success) return err(appContext.error);

    return event.locals.container.slackIntegrationService.updateChannel(input, {
      appId: appContext.data.appId,
      userId: event.locals.auth!.user.id,
    });
  },
);

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
