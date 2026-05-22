import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async (event) => {
  if (!event.locals.auth) {
    throw redirect(302, '/sign-in');
  }

  const organizations = await event.locals.container.authService.api.listOrganizations({
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
