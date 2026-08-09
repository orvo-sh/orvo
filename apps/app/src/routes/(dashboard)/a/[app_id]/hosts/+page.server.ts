import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params }) => {
  const result = await locals.container.agentService.getHosts({
    appId: params.app_id,
  });

  if (!result.success) {
    error(500, result.error);
  }

  return { appId: params.app_id, hosts: result.data.hosts };
}) satisfies PageServerLoad;
