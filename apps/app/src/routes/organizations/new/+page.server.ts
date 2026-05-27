import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async (event) => {
  if (!event.locals.auth) {
    throw redirect(302, '/sign-in');
  }
}) satisfies PageServerLoad;
