import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent }) => {
  const parentData = await parent();
  const appId = parentData.currentApp?.id ?? params.app_id;
  const appName = parentData.currentApp?.name ?? "App";

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [
    logVolumeResult,
    traceSummaryResult,
    alertsResult,
    deploymentsResult,
    servicesResult,
  ] = await Promise.allSettled([
    locals.container.logsService.getLogVolume(
      {
        time: { kind: "preset", preset: "last_hour" },
        search: "",
        levels: [],
        services: [],
        environments: [],
        scopes: [],
        ingestionKeyIds: [],
        bucketCount: 60,
      },
      { appId },
    ),
    locals.container.tracesService.getTraceSummary(
      {
        time: { kind: "preset", preset: "last_hour" },
        search: "",
        services: [],
        environments: [],
        scopes: [],
        ingestionKeyIds: [],
        statusCodes: [],
      },
      { appId },
    ),
    locals.container.alertRuleService.getAlertRules({ appId }),
    locals.container.deploymentService.listDeployments(
      { limit: 5, startAtUtc: oneHourAgo.toISOString() },
      { appId },
    ),
    locals.container.logsService.getLogServiceSummary(
      { time: { kind: "preset", preset: "last_hour" } },
      { appId },
    ),
  ]);

  return {
    appName,
    logVolume:
      logVolumeResult.status === "fulfilled" && logVolumeResult.value.success
        ? logVolumeResult.value.data
        : null,
    traceSummary:
      traceSummaryResult.status === "fulfilled" &&
      traceSummaryResult.value.success
        ? traceSummaryResult.value.data
        : null,
    alerts:
      alertsResult.status === "fulfilled" && alertsResult.value.success
        ? alertsResult.value.data
        : null,
    deployments:
      deploymentsResult.status === "fulfilled" &&
      deploymentsResult.value.success
        ? deploymentsResult.value.data
        : null,
    services:
      servicesResult.status === "fulfilled" && servicesResult.value.success
        ? servicesResult.value.data
        : null,
  };
}) satisfies PageServerLoad;
