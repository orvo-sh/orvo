import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedRedirect } from '$lib/server/auth-redirects';

export const load = (async (event) => {
	if (!event.locals.auth) {
		throw redirect(302, '/sign-in');
	}

	throw redirect(302, await getAuthenticatedRedirect(event));
}) satisfies PageServerLoad;
