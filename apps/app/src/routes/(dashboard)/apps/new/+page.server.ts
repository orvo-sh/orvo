import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const { activeOrganizationId: organizationId } = await event.parent();

  if (!organizationId) {
    throw redirect(302, "/organizations");
  }

  const appsResult = await event.locals.container.appService.listApps({
    organizationId,
  });

  return {
    hasApps: appsResult.success ? appsResult.data.apps.length > 0 : false,
  };
}) satisfies PageServerLoad;
