import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, request, parent }) => {
  const parentData = await parent();
  if (!parentData.currentApp || !locals.auth) {
    throw error(404, "App not found.");
  }

  const accounts = await locals.container.authService.api.listUserAccounts({
    headers: request.headers,
  });

  return {
    user: locals.auth.user,
    accounts,
    hasPassword: accounts.some((account) => account.providerId === "credential"),
  };
}) satisfies PageServerLoad;
