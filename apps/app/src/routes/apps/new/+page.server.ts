import { ensureOrganizationHasBillingPlan } from "$lib/auth-guards";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const g = await ensureOrganizationHasBillingPlan(event)

  const appsResult = await event.locals.container.appService.listApps({
    organizationId: g.activeOrganizationId,
  });

  return {
    hasApps: appsResult.success ? appsResult.data.apps.length > 0 : false,
  };
}) satisfies PageServerLoad;
