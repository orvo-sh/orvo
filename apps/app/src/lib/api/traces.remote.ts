import { getRequestEvent, query } from "$app/server";
import {
  getTraceFilterValueSuggestionsInputSchema,
  getServiceGraphInputSchema,
  getTraceInputSchema,
  getTracesInputSchema,
} from "$lib/server/services/traces.service";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { err } from "@repo/utils";

export const getTracesQuery = query(getTracesInputSchema, async (input) => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.tracesService.getTraces(input, {
    appId: appContext.data.appId,
  });
});

export const getTraceQuery = query(getTraceInputSchema, async (input) => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.tracesService.getTrace(input, {
    appId: appContext.data.appId,
  });
});

export const getServiceGraphQuery = query(
  getServiceGraphInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.tracesService.getServiceGraph(input, {
      appId: appContext.data.appId,
    });
  },
);

export const getTraceFilterValueSuggestionsQuery = query(
  getTraceFilterValueSuggestionsInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.tracesService.getTraceFilterValueSuggestions(
      input,
      {
        appId: appContext.data.appId,
      },
    );
  },
);
