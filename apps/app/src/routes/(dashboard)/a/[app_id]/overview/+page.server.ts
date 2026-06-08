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
    logServiceSummaryResult,
    traceServiceSummaryResult,
    logServiceVolumeResult,
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
    locals.container.tracesService.getTraceServiceSummary(
      {
        time: { kind: "preset", preset: "last_hour" },
      },
      { appId },
    ),
    locals.container.logsService.getLogServiceVolume(
      {
        time: { kind: "preset", preset: "last_hour" },
        search: "",
        levels: [],
        services: [],
        environments: [],
        scopes: [],
        ingestionKeyIds: [],
        bucketCount: 16,
      },
      { appId },
    ),
  ]);

  const logServiceData =
    logServiceSummaryResult.status === "fulfilled" &&
    logServiceSummaryResult.value.success
      ? logServiceSummaryResult.value.data
      : null;
  const traceServiceData =
    traceServiceSummaryResult.status === "fulfilled" &&
    traceServiceSummaryResult.value.success
      ? traceServiceSummaryResult.value.data
      : null;
  const logServiceVolumeData =
    logServiceVolumeResult.status === "fulfilled" &&
    logServiceVolumeResult.value.success
      ? logServiceVolumeResult.value.data
      : null;

  const serviceNames = new Set([
    ...(logServiceData?.services.map((s) => s.name) ?? []),
    ...(traceServiceData?.services.map((s) => s.name) ?? []),
  ]);

  const services = Array.from(serviceNames).map((name) => {
    const logEntry = logServiceData?.services.find((s) => s.name === name);
    const traceEntry = traceServiceData?.services.find((s) => s.name === name);
    const volumeEntry = logServiceVolumeData?.services.find(
      (s) => s.name === name,
    );

    return {
      name,
      logs: logEntry?.total ?? 0,
      logErrors: logEntry?.errors ?? 0,
      traces: traceEntry?.total ?? 0,
      traceErrors: traceEntry?.errors ?? 0,
      errorRate:
        traceEntry != null
          ? traceEntry.errorRate
          : logEntry != null
            ? logEntry.total > 0
              ? logEntry.errors / logEntry.total
              : 0
            : 0,
      p95LatencyMs: traceEntry?.p95LatencyMs ?? 0,
      volumeBuckets: volumeEntry?.buckets ?? [],
    };
  });

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
    services,
  };
}) satisfies PageServerLoad;
