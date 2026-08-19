import { getFriendlyAuthErrorMessage } from "$lib/auth-errors";
import { mode } from "$lib/server/mode";
import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const code = event.url.searchParams.get("error");
  const description = event.url.searchParams.get("error_description");
  const fallbackCallback = "/";
  const rawCallback = event.url.searchParams.get("callback");
  let localSignup:
    | { kind: "setup"; setupToken: string; email?: never; invitationId?: never }
    | {
        kind: "invitation";
        invitationId: string;
        email: string;
        setupToken?: never;
      }
    | null = null;

  if (mode === "local") {
    const claimed = await event.locals.container.localService.isClaimed();
    const setupToken = event.url.searchParams.get("setup_token");
    const invitationId = event.url.searchParams.get("invitation");

    if (
      !claimed &&
      setupToken &&
      event.locals.container.localService.isSetupTokenValid(setupToken)
    ) {
      localSignup = { kind: "setup", setupToken };
    } else if (claimed && invitationId) {
      const invitation =
        await event.locals.container.localService.getInvitation(invitationId);
      if (invitation) {
        localSignup = {
          kind: "invitation",
          invitationId,
          email: invitation.email,
        };
      }
    }

    if (!localSignup) {
      if (claimed) throw redirect(302, "/sign-in");
      throw error(403, "Use the setup URL printed by the Orvo CLI.");
    }
  }

  let callback = fallbackCallback;

  if (rawCallback) {
    try {
      const callbackUrl = new URL(rawCallback, event.url.origin);

      if (callbackUrl.origin === event.url.origin) {
        callback = `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
      }
    } catch {
      callback = fallbackCallback;
    }
  }

  return {
    callback,
    mode,
    localSignup,
    resumeLocalSetup:
      localSignup?.kind === "setup" && event.locals.auth
        ? {
            name: event.locals.auth.user.name,
            email: event.locals.auth.user.email,
          }
        : null,
    error: code
      ? (getFriendlyAuthErrorMessage(code) ??
        description ??
        "Unable to continue with GitHub right now. Please try again.")
      : "",
  };
}) satisfies PageServerLoad;
