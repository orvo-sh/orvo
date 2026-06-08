import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const { activeOrganizationId, user } = await event.parent();

  if (!event.locals.container.billingService) {
    return {
      billingState: null,
      error: "Billing is not configured.",
    };
  }

  const result = await event.locals.container.billingService.getBillingState({
    organizationId: activeOrganizationId,
    userId: user.id,
  });

  if (result.success === false) {
    return {
      billingState: null,
      error: result.error,
    };
  }

  return {
    billingState: result.data,
    error: "",
  };
}) satisfies PageServerLoad;
