import { command, getRequestEvent, query } from "$app/server";
import {
  createIngestionKeyInputSchema,
  getIngestionKeyInputSchema,
  listIngestionKeysInputSchema,
  revokeIngestionKeyInputSchema,
} from "$lib/server/services/ingestion-key";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { err } from "@repo/utils";

export const getIngestionKeyQuery = query(
  getIngestionKeyInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.ingestionKeyService.getIngestionKey(input, {
      appId: appContext.data.appId,
    });
  },
);

export const listIngestionKeysQuery = query(
  listIngestionKeysInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.ingestionKeyService.listIngestionKeys(input, {
      appId: appContext.data.appId,
    });
  },
);

export const createIngestionKeyCommand = command(
  createIngestionKeyInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.ingestionKeyService.createIngestionKey(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);

export const revokeIngestionKeyCommand = command(
  revokeIngestionKeyInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.ingestionKeyService.revokeIngestionKey(
      input,
      {
        appId: appContext.data.appId,
      },
    );
  },
);
