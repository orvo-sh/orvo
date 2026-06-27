import { getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import {
  getLogByIdInputSchema,
  getLogFilterValueSuggestionsInputSchema,
  getLogsInputSchema,
  getLogVolumeInputSchema,
} from "$lib/server/services/logs";
import { err } from "@repo/utils";

export const getLogsQuery = query(getLogsInputSchema, async (input) => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.logsService.getLogs(input, {
    appId: appContext.data.appId,
  });
});

export const getLogByIdQuery = query(getLogByIdInputSchema, async (input) => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.logsService.getLogById(input, {
    appId: appContext.data.appId,
  });
});

export const getLogVolumeQuery = query(
  getLogVolumeInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.logsService.getLogVolume(input, {
      appId: appContext.data.appId,
    });
  },
);

export const getLogFilterValueSuggestionsQuery = query(
  getLogFilterValueSuggestionsInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.logsService.getLogFilterValueSuggestions(
      input,
      {
        appId: appContext.data.appId,
      },
    );
  },
);
