import { getActiveOrganizationId } from "$lib/server/request-context";
import { mode } from "$lib/server/mode";
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load = (async (event) => {
  const auth = event.locals.auth;

  if (!auth) {
    throw redirect(302, "/sign-in");
  }

  if (mode === "cloud" && !auth.user.emailVerified) {
    throw redirect(
      302,
      `/verify-email?email=${encodeURIComponent(auth.user.email)}`,
    );
  }

  const organizations =
    await event.locals.container.authService.api.listOrganizations({
      headers: event.request.headers,
    });

  if (organizations.length === 0) {
    throw redirect(302, "/organizations/new");
  }

  const activeOrganizationId = getActiveOrganizationId(event);
  if (
    !activeOrganizationId ||
    !organizations.some(
      (organization) => organization.id === activeOrganizationId,
    )
  ) {
    throw redirect(302, "/organizations");
  }

  const accessResult =
    await event.locals.container.billingService?.getOrganizationAccessState({
      organizationId: activeOrganizationId,
    });

  if (accessResult && (!accessResult.success || !accessResult.data.hasAccess)) {
    throw redirect(302, "/organizations/plan");
  }

  return {
    activeOrganizationId,
  };
}) satisfies LayoutServerLoad;
