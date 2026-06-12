import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent }) => {
  const parentData = await parent();
  const appId = parentData.currentApp?.id ?? params.app_id;

  const result = await locals.container.hostMonitoringService.getHostDetail(
    { hostId: params.host_id },
    { appId },
  );

  return {
    hostDetailResult: result,
  };
}) satisfies PageServerLoad;
