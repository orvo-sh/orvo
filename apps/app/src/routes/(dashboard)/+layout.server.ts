import { redirect } from "@sveltejs/kit";
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

  return {
    user: locals.auth.user,
    organizations,
    activeOrganizationId,
  };
}) satisfies LayoutServerLoad;
