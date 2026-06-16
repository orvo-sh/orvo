import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const organizationId = event.locals.auth?.session.activeOrganizationId;
  if (!organizationId) throw redirect(302, "/");
  if (!event.locals.container.billingService) throw redirect(302, "/");

  const billingState =
    await event.locals.container.billingService.getBillingState({
      organizationId,
    });

  if (!billingState.success) error(500, billingState.error);

  if (billingState.data.billingPlan) {
    const appsResult = await event.locals.container.appService.listApps({
      organizationId,
    });

    if (!appsResult.success || appsResult.data.apps.length === 0) {
      throw redirect(302, "/apps/new");
    }

    const firstApp = appsResult.data.apps[0];
    throw redirect(302, `/a/${firstApp.id}/settings/billing`);
  }

  return {
    organizationId,
  };
}) satisfies PageServerLoad;
