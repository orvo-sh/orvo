import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params }) => {
  const incidentResult = await locals.container.incidentService.getIncidentDetail(
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
  const deploymentsResult = incident.serviceName
    ? await locals.container.deploymentService.listDeployments(
        {
          serviceName: incident.serviceName,
          startAtUtc: new Date(
            new Date(incident.openedAt).getTime() - 10 * 60_000,
          ).toISOString(),
          endAtUtc: new Date(
            (
              incident.resolvedAt ??
              incident.dismissedAt ??
              new Date()
            ).getTime() + 10 * 60_000,
          ).toISOString(),
          limit: 20,
        },
        { appId: params.app_id },
      )
    : null;

  if (deploymentsResult && !deploymentsResult.success) {
    error(500, deploymentsResult.error);
  }

  return {
    incident,
    events: incidentResult.data.events,
    deliveries: incidentResult.data.deliveries,
    deployments: deploymentsResult?.data.deployments ?? [],
  };
}) satisfies PageServerLoad;
