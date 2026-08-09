import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, url }) => {
  const requestedTime = url.searchParams.get("t");
  const result = await locals.container.agentService.getHost(
    {
      id: params.host_id,
      time:
        requestedTime === "4h" ||
        requestedTime === "24h" ||
        requestedTime === "7d"
          ? requestedTime
          : "1h",
    },
    { appId: params.app_id },
  );

  if (!result.success) {
    error(result.error === "Host not found." ? 404 : 500, result.error);
  }

  return result.data;
}) satisfies PageServerLoad;
