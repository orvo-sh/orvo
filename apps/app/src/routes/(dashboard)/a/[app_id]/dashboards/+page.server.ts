import type { PageServerLoad } from "./$types";
export const load = (async ({ parent }) => {
  const { dashboards, currentApp } = await parent();
  return { dashboards, appId: currentApp.id };
}) satisfies PageServerLoad;
