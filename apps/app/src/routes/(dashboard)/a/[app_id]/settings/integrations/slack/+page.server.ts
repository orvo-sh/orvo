import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent, url }) => {
  const parentData = await parent();
  if (!parentData.currentApp) error(404, "App not found.");

  const result = await locals.container.slackIntegrationService.getIntegration({
    appId: params.app_id,
  });
  if (!result.success) error(500, result.error);

  return {
    integration: result.data.integration,
    requestUrl: new URL(
      "/api/integrations/slack/events",
      url.origin,
    ).toString(),
  };
}) satisfies PageServerLoad;
