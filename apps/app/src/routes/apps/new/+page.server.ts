import { requireOrganization } from "$lib/auth-guards";
import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const g = await requireOrganization(event);

  if (event.locals.container.billingService) {
    const billingState =
      await event.locals.container.billingService.getBillingState({
        organizationId: g.activeOrganizationId,
      });

    if (!billingState.success || !billingState.data.billingPlan) {
      throw redirect(302, "/organizations/plan");
    }
  }

  const appsResult = await event.locals.container.appService.listApps({
    organizationId: g.activeOrganizationId,
  });

  return {
    hasApps: appsResult.success ? appsResult.data.apps.length > 0 : false,
  };
}) satisfies PageServerLoad;
