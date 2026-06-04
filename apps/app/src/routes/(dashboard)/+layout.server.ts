import { redirect } from "@sveltejs/kit";
import { getOrganizationTimezone } from '$lib/timezone';
import type { LayoutServerLoad } from "./$types";

export const load = (async ({ locals, request }) => {
  if (!locals.auth) {
    throw redirect(302, "/sign-in");
  }

  const organizations = await locals.container.authService.api.listOrganizations({
    headers: request.headers,
  });

  if (organizations.length === 0) {
    throw redirect(302, "/organizations/new");
  }

  const activeOrganizationId =
    "activeOrganizationId" in locals.auth.session &&
      typeof locals.auth.session.activeOrganizationId === "string"
      ? locals.auth.session.activeOrganizationId
      : organizations[0]?.id;
  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ?? organizations[0] ?? null;
  const logViewsResult = await locals.container.dashboardLogViewService.getDashboardLogViews({
    organizationId: activeOrganizationId
  });

  return {
    user: locals.auth.user,
    organizations,
    activeOrganizationId,
    activeOrganizationTimezone: getOrganizationTimezone(activeOrganization?.metadata ?? null),
    logViews: logViewsResult.success ? logViewsResult.data.views : []
  };
}) satisfies LayoutServerLoad;
