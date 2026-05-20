import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { auth } from '$lib/server/auth';

export const load = (async (event) => {
  if (!event.locals.auth) {
    throw redirect(302, '/sign-in');
  }

  const organizations = await auth.api.listOrganizations({
    headers: event.request.headers
  });

  if (organizations.length === 0) {
    throw redirect(302, '/organizations/new');
  }

  return {
    organizations,
    user: event.locals.auth.user
  };
}) satisfies PageServerLoad;
