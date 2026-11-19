import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
export const load = (async ({ params, locals, parent }) => {
  const { currentApp } = await parent();
  const result = await locals.container.dashboardService.getDashboard(
    { id: params.dashboard_id },
    { appId: currentApp.id },
  );
  if (!result.success)
    error(result.error === "Dashboard not found." ? 404 : 500, result.error);
  return { dashboard: result.data.dashboard, appId: currentApp.id };
}) satisfies PageServerLoad;
