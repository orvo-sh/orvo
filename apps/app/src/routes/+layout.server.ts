import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getVerifyEmailRedirect } from '$lib/server/auth-redirects';

export const load = (async ({ locals, url }) => {
	const auth = locals.auth;

	if (!auth || auth.user.emailVerified) {
		return;
	}

	if (url.pathname.startsWith('/verify-email')) {
		return;
	}

	throw redirect(302, getVerifyEmailRedirect(auth.user.email));
}) satisfies LayoutServerLoad;
