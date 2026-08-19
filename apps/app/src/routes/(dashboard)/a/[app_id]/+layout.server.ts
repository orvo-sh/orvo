import { getActiveOrganizationId } from "$lib/server/request-context";
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load = (async (event) => {
  const auth = event.locals.auth;

  if (!auth) {
    throw redirect(302, "/sign-in");
  }

  if (!auth.user.emailVerified) {
    throw redirect(
      302,
      `/verify-email?email=${encodeURIComponent(auth.user.email)}`,
    );
  }

  const organizations =
    await event.locals.container.authService.api.listOrganizations({
      headers: event.request.headers,
    });

  if (organizations.length === 0) {
    throw redirect(302, "/organizations/new");
  }

  const activeOrganizationId = getActiveOrganizationId(event);
  if (
    !activeOrganizationId ||
    !organizations.some(
      (organization) => organization.id === activeOrganizationId,
    )
  ) {
    throw redirect(302, "/organizations");
  }

  const currentOrganization =
    organizations.find(
      (organization) => organization.id === activeOrganizationId,
    ) ?? null;
  if (!currentOrganization) {
    throw redirect(302, "/organizations");
  }

  const appsResult = await event.locals.container.appService.listApps({
    organizationId: activeOrganizationId,
  });

  if (!appsResult.success) {
    throw redirect(302, "/apps/new");
  }

  const apps = appsResult.data.apps;
  if (apps.length === 0) {
    throw redirect(302, "/apps/new");
  }

  const currentApp = apps.find((app) => app.id === event.params.app_id) ?? null;
  if (!currentApp) {
    throw redirect(302, `/a/${apps[0].id}`);
  }

  const accessResult =
    await event.locals.container.billingService?.getOrganizationAccessState({
      organizationId: activeOrganizationId,
    });

  if (
    accessResult &&
    (!accessResult.success ||
      (!accessResult.data.hasAccess && !accessResult.data.trialExpired))
  ) {
    throw redirect(302, "/organizations/plan");
  }

  const billingStateResult =
    await event.locals.container.billingService?.getBillingState({
      organizationId: activeOrganizationId,
    });

  return {
    user: auth.user,
    organizations,
    activeOrganizationId,
    currentOrganization,
    apps,
    currentApp,
    billingSummary:
      billingStateResult && billingStateResult.success
        ? {
            billingPlan: billingStateResult.data.billingPlan,
            billingStatus: billingStateResult.data.billingStatus,
            trialStart: billingStateResult.data.trialStart,
            trialEnd: billingStateResult.data.trialEnd,
            includedBytes: billingStateResult.data.ingestLimitBytes,
            usedBytes:
              billingStateResult.data.logsIngestedBytes +
              billingStateResult.data.metricsIngestedBytes +
              billingStateResult.data.tracesIngestedBytes,
            logsIngestedBytes: billingStateResult.data.logsIngestedBytes,
            metricsIngestedBytes: billingStateResult.data.metricsIngestedBytes,
            tracesIngestedBytes: billingStateResult.data.tracesIngestedBytes,
            usagePercent:
              billingStateResult.data.ingestLimitBytes > 0
                ? Math.min(
                    100,
                    Math.round(
                      ((billingStateResult.data.logsIngestedBytes +
                        billingStateResult.data.metricsIngestedBytes +
                        billingStateResult.data.tracesIngestedBytes) /
                        billingStateResult.data.ingestLimitBytes) *
                        100,
                    ),
                  )
                : 0,
          }
        : null,
  };
}) satisfies LayoutServerLoad;
