import type { RequestEvent } from "@sveltejs/kit";

const getActiveOrganizationId = (event: RequestEvent) => {
  const auth = event.locals.auth;

  if (
    !auth ||
    !("activeOrganizationId" in auth.session) ||
    typeof auth.session.activeOrganizationId !== "string" ||
    auth.session.activeOrganizationId.length === 0
  ) {
    return null;
  }

  return auth.session.activeOrganizationId;
};

const resolveRequestAppContext = async (event: RequestEvent) => {
  const organizationId = getActiveOrganizationId(event);
  const appId = event.params.app_id;

  if (!organizationId || !appId) {
    return {
      success: false as const,
      error: "App context is missing.",
    };
  }

  const appResult = await event.locals.container.appService.getApp(
    { id: appId },
    { organizationId },
  );
  if (!appResult.success) {
    return appResult;
  }

  if (
    !event.locals.auth ||
    !(await event.locals.container.appService.canAccessApp({
      appId,
      organizationId,
      userId: event.locals.auth.user.id,
    }))
  ) {
    return {
      success: false as const,
      error: "You do not have access to this app.",
    };
  }

  return {
    success: true as const,
    data: {
      organizationId,
      appId,
      app: appResult.data.app,
    },
  };
};

export { getActiveOrganizationId, resolveRequestAppContext };
