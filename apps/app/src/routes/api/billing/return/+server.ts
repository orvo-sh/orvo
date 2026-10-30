import { getActiveOrganizationId } from "$lib/server/request-context";
import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const GET: RequestHandler = async (event) => {
  if (!event.locals.auth) redirect(303, "/sign-in");
  const organizationId = getActiveOrganizationId(event);
  if (!organizationId) redirect(303, "/organizations");
  if (!event.locals.container.billingService)
    error(503, "Billing is not configured.");

  const result =
    await event.locals.container.billingService.completeBillingFlow(
      {
        appId: event.url.searchParams.get("appId") ?? "",
        returnPath: event.url.searchParams.get("returnPath") ?? undefined,
        paymentMethodUpdated:
          event.url.searchParams.get("paymentMethodUpdated") === "1",
      },
      {
        organizationId,
        userId: event.locals.auth.user.id,
        origin: event.url.origin,
      },
    );
  if (!result.success) error(400, result.error);
  redirect(303, result.data.url);
};

export { GET };
