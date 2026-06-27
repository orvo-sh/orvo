import { command, getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import {
  createNotificationDestinationInputSchema,
  deleteNotificationDestinationInputSchema,
  testNotificationDestinationInputSchema,
  updateNotificationDestinationInputSchema,
} from "$lib/server/services/notification-destination";
import { err } from "@repo/utils";
import { z } from "zod";

export const getNotificationDestinationsQuery = query(
  z.object({}),
  async () => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.notificationDestinationService.listNotificationDestinations(
      {
        appId: appContext.data.appId,
      },
    );
  },
);

export const createNotificationDestinationCommand = command(
  createNotificationDestinationInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.notificationDestinationService.createNotificationDestination(
      input,
      {
        appId: appContext.data.appId,
        organizationId: appContext.data.organizationId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const updateNotificationDestinationCommand = command(
  updateNotificationDestinationInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.notificationDestinationService.updateNotificationDestination(
      input,
      {
        appId: appContext.data.appId,
        organizationId: appContext.data.organizationId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const deleteNotificationDestinationCommand = command(
  deleteNotificationDestinationInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.notificationDestinationService.deleteNotificationDestination(
      input,
      {
        appId: appContext.data.appId,
      },
    );
  },
);

export const testNotificationDestinationCommand = command(
  testNotificationDestinationInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.notificationDestinationService.testNotificationDestination(
      input,
      {
        appId: appContext.data.appId,
      },
    );
  },
);
