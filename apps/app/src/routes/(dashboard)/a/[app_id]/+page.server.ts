import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  throw redirect(302, `/a/${event.params.app_id}/overview`);
}) satisfies PageServerLoad;
