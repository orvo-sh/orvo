import { getActiveOrganizationId } from "$lib/server/request-context";
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET = (async (event) => {
  const organizationId = getActiveOrganizationId(event);
  const appId = event.url.searchParams.get("app_id")?.trim();

  if (!event.locals.auth || !organizationId || !appId) {
    throw redirect(303, "/sign-in");
  }

  const appResult = await event.locals.container.appService.getApp(
    { id: appId },
    { organizationId },
  );
  if (!appResult.success) {
    return new Response(appResult.error, { status: 403 });
  }

  const result =
    await event.locals.container.slackIntegrationService.createConnectUrl({
      appId,
      organizationId,
      userId: event.locals.auth.user.id,
    });
  if (!result.success) {
    throw redirect(
      303,
      `/a/${encodeURIComponent(appId)}/settings/notification-destinations?error=${encodeURIComponent(result.error)}`,
    );
  }

  throw redirect(303, result.data.url);
}) satisfies RequestHandler;
