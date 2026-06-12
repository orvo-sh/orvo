import { getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { getInsightsInputSchema } from "$lib/server/services/insights.service";
import { err } from "@repo/utils";

export const getInsightsQuery = query(getInsightsInputSchema, async (input) => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.insightsService.getInsights(input, {
    appId: appContext.data.appId,
  });
});
