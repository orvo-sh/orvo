import { command, getRequestEvent, query } from "$app/server";
import {
  createAlertWebhookDestinationInputSchema,
  deleteAlertWebhookDestinationInputSchema,
  testAlertWebhookDestinationInputSchema,
  updateAlertWebhookDestinationInputSchema,
} from "$lib/server/services/alert-webhook-destination.service";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { err } from "@repo/utils";
import { z } from "zod";

export const getAlertWebhookDestinationsQuery = query(
  z.object({}),
  async () => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.alertWebhookDestinationService.getAlertWebhookDestinations(
      {
        appId: appContext.data.appId,
      },
    );
  },
);

export const createAlertWebhookDestinationCommand = command(
  createAlertWebhookDestinationInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.alertWebhookDestinationService.createAlertWebhookDestination(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const updateAlertWebhookDestinationCommand = command(
  updateAlertWebhookDestinationInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.alertWebhookDestinationService.updateAlertWebhookDestination(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const deleteAlertWebhookDestinationCommand = command(
  deleteAlertWebhookDestinationInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.alertWebhookDestinationService.deleteAlertWebhookDestination(
      input,
      {
        appId: appContext.data.appId,
      },
    );
  },
);

export const testAlertWebhookDestinationCommand = command(
  testAlertWebhookDestinationInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.alertWebhookDestinationService.testAlertWebhookDestination(
      input,
      {
        appId: appContext.data.appId,
      },
    );
  },
);
