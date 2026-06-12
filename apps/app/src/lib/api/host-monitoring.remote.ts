import { command, getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import {
  createHostInstallSessionInputSchema,
  getHostDetailInputSchema,
  getHostsInputSchema,
} from "$lib/server/services/host-monitoring.service";
import { err } from "@repo/utils";

export const createHostInstallSessionCommand = command(
  createHostInstallSessionInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.hostMonitoringService.createInstallSession(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const getHostsQuery = query(getHostsInputSchema, async (input) => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.hostMonitoringService.getHosts(input, {
    appId: appContext.data.appId,
  });
});

export const getHostDetailQuery = query(
  getHostDetailInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.hostMonitoringService.getHostDetail(input, {
      appId: appContext.data.appId,
    });
  },
);
