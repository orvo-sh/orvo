import { getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import { getOpenIncidentsInputSchema } from "$lib/server/services/incident.service";
import { err } from "@repo/utils";

export const getOpenIncidentsQuery = query(
  getOpenIncidentsInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.incidentService.getOpenIncidents(input, {
      appId: appContext.data.appId,
    });
  },
);
