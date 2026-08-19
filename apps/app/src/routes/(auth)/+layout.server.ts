import { getActiveOrganizationId } from "$lib/server/request-context";
import { mode } from "$lib/server/mode";
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load = (async (event) => {
  const auth = event.locals.auth;
  const email = event.url.searchParams.get("email");

  if (!auth) {
    if (event.url.pathname === "/verify-email" && !email) {
      throw redirect(302, "/");
    }

    return;
  }

  if (mode === "cloud" && !auth.user.emailVerified) {
    if (event.url.pathname === "/verify-email" && email === auth.user.email) {
      return;
    }

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

  const appsResult = await event.locals.container.appService.listApps({
    organizationId: activeOrganizationId,
  });

  if (!appsResult.success) {
    throw redirect(302, "/apps/new");
  }

  const firstApp = appsResult.data.apps[0];
  throw redirect(302, firstApp ? `/a/${firstApp.id}` : "/apps/new");
}) satisfies LayoutServerLoad;
