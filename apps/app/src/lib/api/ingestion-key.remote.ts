import { command, getRequestEvent, query } from "$app/server";
import {
  getIngestionKeyInputSchema,
  rotateIngestionKeyInputSchema,
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

export const rotateIngestionKeyCommand = command(
  rotateIngestionKeyInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.ingestionKeyService.rotateIngestionKey(
      input,
      {
        appId: appContext.data.appId,
        userId: event.locals.auth!.user.id,
      },
    );
  },
);
