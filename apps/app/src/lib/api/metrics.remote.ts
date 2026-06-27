import { getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { getMetricsExplorerInputSchema } from "$lib/server/services/metrics";
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
