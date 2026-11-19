import { getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import {
  getAlertMetricOptionsInputSchema,
  getContainerNameSuggestionsInputSchema,
  getMetricsExplorerInputSchema,
} from "$lib/server/services/metrics";
import { err } from "@repo/utils";

export const getMetricsExplorerQuery = query(
  getMetricsExplorerInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.metricsService.getMetricsExplorer(input, {
      appId: appContext.data.appId,
    });
  },
);

export const getContainerNameSuggestionsQuery = query(
  getContainerNameSuggestionsInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);
    if (!appContext.success) return err(appContext.error);
    return event.locals.container.metricsService.getContainerNameSuggestions(
      input,
      { appId: appContext.data.appId },
    );
  },
);

export const getAlertMetricOptionsQuery = query(
  getAlertMetricOptionsInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);
    if (!appContext.success) return err(appContext.error);
    return event.locals.container.metricsService.getAlertMetricOptions(input, {
      appId: appContext.data.appId,
    });
  },
);
