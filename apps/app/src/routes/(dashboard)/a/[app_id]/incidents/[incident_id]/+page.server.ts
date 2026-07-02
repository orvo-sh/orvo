import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params }) => {
  const incidentResult =
    await locals.container.incidentService.getIncidentDetail(
      params.incident_id,
      { appId: params.app_id },
    );

  if (!incidentResult.success) {
    error(
      incidentResult.error === "Incident not found." ? 404 : 500,
      incidentResult.error,
    );
  }

  const incident = incidentResult.data.incident;

  return {
    incident,
    events: incidentResult.data.events,
    deliveries: incidentResult.data.deliveries,
  };
}) satisfies PageServerLoad;
