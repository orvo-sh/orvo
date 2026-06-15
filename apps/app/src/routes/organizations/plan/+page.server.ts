import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  if (!event.locals.auth?.session.activeOrganizationId) throw redirect(302, "/");
  if (!event.locals.container.billingService) throw redirect(302, "/");

  const billingState =
    await event.locals.container.billingService.getBillingState({ organizationId: event.locals.auth.session.activeOrganizationId });

  if (!billingState.success) error(500, billingState.error)

  if (billingState.data.billingPlan) throw redirect(302, "/settings/billing");

  return {
    organizationId: event.locals.auth?.session.activeOrganizationId,
  };
}) satisfies PageServerLoad;
