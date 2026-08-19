import { mode } from "$lib/server/mode";
import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  if (mode !== "local") throw redirect(302, "/");
  if (await event.locals.container.localService.isClaimed()) {
    throw redirect(302, "/sign-in");
  }

  const token = event.url.searchParams.get("token") ?? "";
  if (!event.locals.container.localService.isSetupTokenValid(token)) {
    throw error(403, "Use the setup URL printed by the Orvo CLI.");
  }

  throw redirect(302, `/sign-up?setup_token=${encodeURIComponent(token)}`);
}) satisfies PageServerLoad;
