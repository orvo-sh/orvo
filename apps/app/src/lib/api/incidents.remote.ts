import { command, getRequestEvent, query } from "$app/server";
import { resolveRequestAppContext } from "$lib/server/request-context";
import {
  dismissIncidentInputSchema,
  getIncidentInputSchema,
  getOpenIncidentsInputSchema,
  listIncidentsInputSchema,
  resolveIncidentInputSchema,
} from "$lib/server/services/incident";
import { err } from "@repo/utils";

export const getIncidentsQuery = query(
  listIncidentsInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.incidentService.listIncidents(input, {
      appId: appContext.data.appId,
    });
  },
);

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

export const getIncidentQuery = query(getIncidentInputSchema, async (input) => {
  const event = getRequestEvent();
  const appContext = await resolveRequestAppContext(event);

  if (!appContext.success) {
    return err(appContext.error);
  }

  return event.locals.container.incidentService.getIncidentDetail(input, {
    appId: appContext.data.appId,
  });
});

export const resolveIncidentCommand = command(
  resolveIncidentInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.incidentService.resolveIncident(input, {
      appId: appContext.data.appId,
      userId: event.locals.auth!.user.id,
    });
  },
);

export const dismissIncidentCommand = command(
  dismissIncidentInputSchema,
  async (input) => {
    const event = getRequestEvent();
    const appContext = await resolveRequestAppContext(event);

    if (!appContext.success) {
      return err(appContext.error);
    }

    return event.locals.container.incidentService.dismissIncident(input, {
      appId: appContext.data.appId,
      userId: event.locals.auth!.user.id,
    });
  },
);
