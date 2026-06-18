import { ok } from "@repo/utils";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent }) => {
  const { currentApp } = await parent();
  if (!currentApp) {
    error(404, "App not found.");
  }

  const hasReceivedTrace = !!currentApp.tracesFirstReceivedAt;
  const hasReceivedLog = !!currentApp.logsFirstReceivedAt;
  const hasReceivedMetric = !!currentApp.metricsFirstReceivedAt;
  const hasReceivedFirstSignal =
    hasReceivedTrace || hasReceivedLog || hasReceivedMetric;

  const [keyRes, hostsRes, activationRes] = await Promise.all([
    hasReceivedFirstSignal
      ? ok(null)
      : locals.container.ingestionKeyService.getIngestionKey(
          { kind: "private" },
          { appId: params.app_id },
        ),
    locals.container.hostMonitoringService.getHosts(
      {},
      { appId: params.app_id },
    ),
    locals.container.organizationActivationService.getOrganizationActivation({
      organizationId: currentApp.organizationId,
    }),
  ]);

  if (!keyRes.success || !hostsRes.success || !activationRes.success) {
    error(500, "Failed to load onboarding data.");
  }

  const hosts = hostsRes.success ? hostsRes.data.hosts : [];
  const hasConnectedHost = hosts.length > 0;

  return {
    ingestionKey: keyRes.data?.key?.key ?? null,
    hasReceivedTrace,
    hasReceivedLog,
    hasReceivedMetric,
    hasReceivedFirstSignal,
    hasConnectedHost,
    activation: activationRes.data.activation,
  };
}) satisfies PageServerLoad;
