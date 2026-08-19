import { mode } from "$lib/server/mode";
import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  if (mode !== "local") throw redirect(302, "/");

  const invitation = await event.locals.container.localService.getInvitation(
    event.params.invitation_id,
  );
  if (!invitation) throw error(404, "This invitation is invalid or expired.");

  if (!event.locals.auth) {
    const callback = `/invite/${invitation.id}`;
    throw redirect(
      302,
      `/sign-up?invitation=${encodeURIComponent(invitation.id)}&callback=${encodeURIComponent(callback)}`,
    );
  }

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
    },
    emailMatches:
      event.locals.auth.user.email.toLowerCase() ===
      invitation.email.toLowerCase(),
  };
}) satisfies PageServerLoad;
