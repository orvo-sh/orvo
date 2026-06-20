import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params }) => {
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


  if (!monitorsResult.success) error(500, monitorsResult.error);
  if (!destinationsResult.success) error(500, destinationsResult.error);

  return {
    monitors: monitorsResult.data.monitors,
    destinations: destinationsResult.data.destinations,
  };
}) satisfies PageServerLoad;
