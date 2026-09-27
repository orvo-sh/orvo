import { requireVerifiedUser } from "$lib/auth-guards";
import { enqueueSlackScoutRun } from "$lib/server/workers";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load = (async (event) => {
  const callback = `${event.url.pathname}${event.url.search}`;
  const auth = requireVerifiedUser(event, {
    signInRedirectTo: `/sign-in?callback=${encodeURIComponent(callback)}`,
    verifyRedirectTo: "/verify-email",
  });
  return {
    token: event.url.searchParams.get("token") ?? "",
    user: { name: auth.user.name, email: auth.user.email },
  };
}) satisfies PageServerLoad;

export const actions = {
  default: async (event) => {
    const auth = requireVerifiedUser(event);
    const form = await event.request.formData();
    const token = form.get("token");
    if (typeof token !== "string" || !token) {
      return fail(400, { error: "This Slack account link is invalid." });
    }
    const result =
      await event.locals.container.slackIntegrationService.completeLink(
        { token },
        { userId: auth.user.id },
      );
    if (!result.success) return fail(400, { error: result.error });
    await enqueueSlackScoutRun({
      kind: "message",
      eventId: result.data.eventId,
    });
    return { linked: true };
  },
} satisfies Actions;
