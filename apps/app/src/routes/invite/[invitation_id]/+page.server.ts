import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
  const invitation =
    await event.locals.container.invitationService.getInvitation(
      event.params.invitation_id,
    );
  if (!invitation) throw error(404, "This invitation is invalid or expired.");

  if (!event.locals.auth) {
    const callback = `/invite/${encodeURIComponent(invitation.id)}`;
    throw redirect(
      302,
      `/sign-up?email=${encodeURIComponent(invitation.email)}&callback=${encodeURIComponent(callback)}`,
    );
  }

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      organizationName: invitation.organization.name,
    },
    signedInEmail: event.locals.auth.user.email,
    emailMatches:
      event.locals.auth.user.email.toLowerCase() ===
      invitation.email.toLowerCase(),
  };
}) satisfies PageServerLoad;
