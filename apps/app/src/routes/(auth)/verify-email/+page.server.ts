import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAuthenticatedRedirect, getVerifyEmailRedirect } from '$lib/server/auth-redirects';

export const load = (async (event) => {
	const auth = event.locals.auth;

	if (auth?.user.emailVerified) {
		throw redirect(302, await getAuthenticatedRedirect(event));
	}

	if (auth && event.url.searchParams.get('email') !== auth.user.email) {
		throw redirect(302, getVerifyEmailRedirect(auth.user.email));
	}

	if (!event.url.searchParams.has('email')) {
		throw redirect(302, auth ? getVerifyEmailRedirect(auth.user.email) : '/');
	}

	return {
		email: event.url.searchParams.get('email') || ''
	};
}) satisfies PageServerLoad;
