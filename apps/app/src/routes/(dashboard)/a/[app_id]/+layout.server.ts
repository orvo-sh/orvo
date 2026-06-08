import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load = (async (event) => {
  const { locals, params, parent } = event;
  const parentData = await parent();
  const organizationId = parentData.activeOrganizationId;

  if (!organizationId) {
    throw redirect(302, "/organizations");
  }

  const currentOrganization =
    parentData.organizations.find(
      (organization) => organization.id === organizationId,
    ) ?? null;
  if (!currentOrganization) {
    throw redirect(302, "/organizations");
  }

  const appsResult = await locals.container.appService.listApps({
    organizationId,
  });
  if (!appsResult.success) {
    throw redirect(302, "/apps/new");
  }

  const apps = appsResult.data.apps;
  if (apps.length === 0) {
    throw redirect(302, "/apps/new");
  }

  const currentApp = apps.find((app) => app.id === params.app_id);
  if (!currentApp) {
    throw redirect(302, `/a/${apps[0].id}`);
  }

  const logViewsResult =
    await locals.container.dashboardLogViewService.getDashboardLogViews({
      appId: currentApp.id,
    });

  return {
    apps,
    currentApp,
    currentOrganization,
    logViews: logViewsResult.success ? logViewsResult.data.views : [],
  };
}) satisfies LayoutServerLoad;
