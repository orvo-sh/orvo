import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET = (async (event) => {
  const code = event.url.searchParams.get("code")?.trim();
  const state = event.url.searchParams.get("state")?.trim();
  const oauthError = event.url.searchParams.get("error")?.trim();

  if (!state) {
    return new Response("Invalid Slack authorization state.", { status: 400 });
  }

  const result =
    await event.locals.container.slackIntegrationService.completeOauth({
      code: code ?? "",
      state,
      oauthError,
    });
  if (!result.success) {
    if ("appId" in result && result.appId) {
      throw redirect(
        303,
        `/a/${encodeURIComponent(result.appId)}/settings/integrations/slack?error=${encodeURIComponent(result.error)}`,
      );
    }
    return new Response(result.error, { status: 400 });
  }

  throw redirect(
    303,
    `/a/${encodeURIComponent(result.data.appId)}/settings/integrations/slack?connected=1`,
  );
}) satisfies RequestHandler;
