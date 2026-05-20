import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { auth } from '$lib/server/auth';

export const load = (async (event) => {
  if (!event.locals.auth) {
    throw redirect(302, '/sign-in');
  }

  const organizations = await auth.api.listOrganizations({ headers: event.request.headers });
  const activeOrganizationId = event.locals.auth.session.activeOrganizationId;

  if (!activeOrganizationId) {
    if (organizations.length === 0) {
      throw redirect(302, '/organizations/new');
    }

    throw redirect(302, '/organizations');
  }

  const activeOrganization = organizations.find((organization) => organization.id === activeOrganizationId);

  if (!activeOrganization) {
    throw redirect(302, '/organizations');
  }

  return {
    activeOrganization,
    organizations,
    user: event.locals.auth.user
  };
}) satisfies PageServerLoad;

export const actions = {
  signOut: async (event) => {
    await auth.api.signOut({
      headers: event.request.headers
    });

    throw redirect(302, '/sign-in');
  }
} satisfies Actions;
