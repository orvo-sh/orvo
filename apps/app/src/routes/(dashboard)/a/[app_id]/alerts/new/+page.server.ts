import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent }) => {
  const parentData = await parent();
  if (!parentData.currentApp) {
    error(404, "App not found.");
  }

  const destinationsResult =
    await locals.container.notificationDestinationService.listNotificationDestinations(
      {
        appId: params.app_id,
      },
    );

  if (!destinationsResult.success) {
    error(500, destinationsResult.error);
  }

  return {
    destinations: destinationsResult.data.destinations,
  };
}) satisfies PageServerLoad;
