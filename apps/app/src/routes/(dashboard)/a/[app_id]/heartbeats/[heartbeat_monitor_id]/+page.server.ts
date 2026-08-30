import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent }) => {
  const { currentApp } = await parent();
  if (!currentApp) {
    error(404, "App not found.");
  }

  const [
    monitorResult,
    historyResult,
    destinationsResult,
    incidentsResult,
    incidentEventsResult,
  ] = await Promise.all([
    locals.container.heartbeatService.getHeartbeatMonitor(
      params.heartbeat_monitor_id,
      {
        appId: params.app_id,
      },
    ),
    locals.container.heartbeatService.getHeartbeatCheckInHistory(
      params.heartbeat_monitor_id,
      {
        appId: params.app_id,
      },
    ),
    locals.container.notificationDestinationService.listNotificationDestinations(
      {
        appId: params.app_id,
      },
    ),
    locals.container.incidentService.getOpenIncidents(
      {
        sourceType: "heartbeat",
        sourceId: params.heartbeat_monitor_id,
        limit: 20,
      },
      { appId: params.app_id },
    ),
    locals.container.incidentService.listSourceEvents(
      {
        sourceType: "heartbeat",
        sourceId: params.heartbeat_monitor_id,
        limit: 40,
      },
      { appId: params.app_id },
    ),
  ]);

  if (!monitorResult.success) {
    error(
      monitorResult.error === "Heartbeat monitor not found." ? 404 : 500,
      monitorResult.error,
    );
  }

  if (
    !historyResult.success ||
    !destinationsResult.success ||
    !incidentsResult.success ||
    !incidentEventsResult.success
  ) {
    error(500, "Failed to load heartbeat monitor.");
  }

  return {
    monitor: monitorResult.data.monitor,
    history: historyResult.data.history,
    destinations: destinationsResult.data.destinations,
    incidents: incidentsResult.data.incidents,
    incidentEvents: incidentEventsResult.data.events,
  };
}) satisfies PageServerLoad;
