import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  if (!event.locals.auth?.session.activeOrganizationId) throw redirect(302, "/");
  if (!event.locals.container.billingService) throw redirect(302, "/");
  
    const organization =
    await event.locals.container.authService.api.getFullOrganization({
      headers: event.request.headers,
    });

  if (organization?.billingPlan) {
    throw redirect(302, "/settings/billing");
  }

  const plansResult = event.locals.container.billingService.getPlans();
  if (!plansResult.success) {
    throw redirect(302, "/");
  }

  return {
    organizationId: event.locals.auth?.session.activeOrganizationId,
    plans: plansResult.data,
  };
}) satisfies PageServerLoad;
