import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent }) => {
  const parentData = await parent();
  if (!parentData.currentApp) {
    error(404, "App not found.");
  }

  const [destinationsResult, defaultRecipientsResult] = await Promise.all([
    locals.container.notificationDestinationService.listNotificationDestinations(
      {
        appId: params.app_id,
      },
    ),
    locals.container.notificationDestinationService.getDefaultEmailRecipients({
      organizationId: parentData.activeOrganizationId,
    }),
  ]);

  return {
    destinationsResult,
    defaultRecipientsResult,
  };
}) satisfies PageServerLoad;
