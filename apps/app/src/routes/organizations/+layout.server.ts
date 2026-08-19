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

  if (mode === "local" && event.url.pathname === "/organizations/new") {
    throw redirect(302, "/");
  }

  if (
    organizations.length === 0 &&
    event.url.pathname !== "/organizations/new"
  ) {
    throw redirect(302, "/organizations/new");
  }

  const activeOrganizationId = getActiveOrganizationId(event);
  if (
    event.url.pathname === "/organizations/plan" &&
    (!activeOrganizationId ||
      !organizations.some(
        (organization) => organization.id === activeOrganizationId,
      ))
  ) {
    throw redirect(302, "/organizations");
  }

  return {
    organizations,
    user: auth.user,
    activeOrganizationId: activeOrganizationId ?? undefined,
  };
}) satisfies LayoutServerLoad;
