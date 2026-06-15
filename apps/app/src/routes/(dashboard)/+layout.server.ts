import { getActiveOrganizationId } from "$lib/server/request-context";
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load = (async (event) => {
  const auth = event.locals.auth;

  if (!auth) {
    throw redirect(302, "/sign-in");
  }

  if (!auth.user.emailVerified) {
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

  if (event.url.pathname === "/") {
    const appsResult = await event.locals.container.appService.listApps({
      organizationId: activeOrganizationId,
    });

    if (!appsResult.success) {
      throw redirect(302, "/apps/new");
    }

    const firstApp = appsResult.data.apps[0];
    throw redirect(302, firstApp ? `/a/${firstApp.id}` : "/apps/new");
  }

  const activationResult =
    await event.locals.container.organizationActivationService.getOrganizationActivation(
      {
        organizationId: activeOrganizationId,
      },
    );
  const activationCookieName = `organization_activation_open_${activeOrganizationId}`;

  return {
    user: auth.user,
    organizations,
    activeOrganizationId,
    organizationActivation: activationResult.success
      ? activationResult.data.activation
      : null,
    organizationActivationOpen: event.cookies.get(activationCookieName) !== "0",
  };
}) satisfies LayoutServerLoad;
