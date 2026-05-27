import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getAuthenticatedRedirect, getVerifyEmailRedirect } from '$lib/server/auth-redirects';

export const load = (async (event) => {
	const auth = event.locals.auth;

	if (!auth) {
		return;
	}

	if (!auth.user.emailVerified) {
		if (
			event.url.pathname === '/verify-email' &&
			event.url.searchParams.get('email') === auth.user.email
		) {
			return;
		}

		throw redirect(302, getVerifyEmailRedirect(auth.user.email));
	}

	throw redirect(302, await getAuthenticatedRedirect(event));
}) satisfies LayoutServerLoad;
