import { logTimePresetSchema } from "$lib/server/services/logs.service";
import type { PageServerLoad } from "./$types";

const timePresetToBuckets: Record<string, number> = {
  last_30_minutes: 30,
  last_hour: 60,
  last_4_hours: 48,
  last_24_hours: 48,
  last_7_days: 56,
};

export const load = (async ({ url, locals, params, parent }) => {
  const parentData = await parent();
  const appId = parentData.currentApp?.id ?? params.app_id;
  const appName = parentData.currentApp?.name ?? "App";

  const rawPreset = url.searchParams.get("t");
  const parsedPreset = logTimePresetSchema.safeParse(rawPreset);
  const timePreset = parsedPreset.success ? parsedPreset.data : "last_hour";
  const timeFilter = { kind: "preset" as const, preset: timePreset };

  const bucketCount = timePresetToBuckets[timePreset] ?? 48;
  const serviceBuckets = Math.min(Math.max(Math.ceil(bucketCount / 4), 8), 24);

  const now = new Date();
  const rangeStart = new Date(
    now.getTime() -
      {
        last_30_minutes: 30,
        last_hour: 60,
        last_4_hours: 240,
        last_24_hours: 1440,
        last_7_days: 10080,
        last_3_days: 4320,
        last_2_weeks: 20160,
        last_month: 43200,
        today: 0,
      }[timePreset] *
        60 *
        1000,
  );

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
        time: timeFilter,
        search: "",
        levels: [],
        services: [],
        environments: [],
        scopes: [],
        ingestionKeyIds: [],
        bucketCount,
      },
      { appId },
    ),
    locals.container.tracesService.getTraceSummary(
      {
        time: timeFilter,
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
      { limit: 5, startAtUtc: rangeStart.toISOString() },
      { appId },
    ),
    locals.container.logsService.getLogServiceSummary(
      { time: timeFilter },
      { appId },
    ),
    locals.container.tracesService.getTraceServiceSummary(
      { time: timeFilter },
      { appId },
    ),
    locals.container.logsService.getLogServiceVolume(
      {
        time: timeFilter,
        search: "",
        levels: [],
        services: [],
        environments: [],
        scopes: [],
        ingestionKeyIds: [],
        bucketCount: serviceBuckets,
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
    timePreset,
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
