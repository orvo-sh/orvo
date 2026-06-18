import { command, getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import {
  createHeartbeatMonitorInputSchema,
  deleteHeartbeatMonitorInputSchema,
  getHeartbeatMonitorInputSchema,
  regenerateHeartbeatMonitorSecretInputSchema,
  sendHeartbeatMonitorTestAlertInputSchema,
  toggleHeartbeatMonitorPausedInputSchema,
  updateHeartbeatMonitorInputSchema,
} from "$lib/server/services/heartbeat.service";
import { err } from "@repo/utils";
import { z } from "zod";

export const getHeartbeatMonitorsQuery = query(z.object({}), async () => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.heartbeatService.listHeartbeatMonitors({
    appId: appContext.data.appId,
  });
});

export const getHeartbeatMonitorQuery = query(
  getHeartbeatMonitorInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.heartbeatService.getHeartbeatMonitor(input, {
      appId: appContext.data.appId,
    });
  },
);

export const createHeartbeatMonitorCommand = command(
  createHeartbeatMonitorInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.heartbeatService.createHeartbeatMonitor(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const updateHeartbeatMonitorCommand = command(
  updateHeartbeatMonitorInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.heartbeatService.updateHeartbeatMonitor(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const deleteHeartbeatMonitorCommand = command(
  deleteHeartbeatMonitorInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.heartbeatService.deleteHeartbeatMonitor(
      input,
      {
        appId: appContext.data.appId,
      },
    );
  },
);

export const regenerateHeartbeatMonitorSecretCommand = command(
  regenerateHeartbeatMonitorSecretInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.heartbeatService.regenerateHeartbeatMonitorSecret(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const toggleHeartbeatMonitorPausedCommand = command(
  toggleHeartbeatMonitorPausedInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.heartbeatService.toggleHeartbeatMonitorPaused(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const sendHeartbeatMonitorTestAlertCommand = command(
  sendHeartbeatMonitorTestAlertInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.heartbeatService.sendHeartbeatMonitorTestAlert(
      input,
      {
        appId: appContext.data.appId,
      },
    );
  },
);
