import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent }) => {
  const { currentApp } = await parent();
  if (!currentApp) {
    error(404, "App not found.");
  }

  const [monitorsResult, destinationsResult] = await Promise.all([
    locals.container.heartbeatService.listHeartbeatMonitors({
      appId: params.app_id,
    }),
    locals.container.notificationDestinationService.listNotificationDestinations(
      {
        appId: params.app_id,
      },
    ),
  ]);

  return {
    monitorsResult,
    destinationsResult,
  };
}) satisfies PageServerLoad;
