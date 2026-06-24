import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params }) => {
  const incidentsResult = await locals.container.incidentService.listIncidents(
    {
      status: "all",
      limit: 500,
    },
    { appId: params.app_id },
  );

  if (!incidentsResult.success) {
    error(500, incidentsResult.error);
  }

  return {
    incidents: incidentsResult.data.incidents,
  };
}) satisfies PageServerLoad;
