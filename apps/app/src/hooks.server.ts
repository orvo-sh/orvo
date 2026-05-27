import { building } from '$app/environment';
import { createServerContainer } from '$lib/server/container';
import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	event.locals.container = createServerContainer();

	const { authService } = event.locals.container;
	const session = await authService.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.auth = {
			session: session.session,
			user: session.user,
		};
	}

	return svelteKitHandler({ event, resolve, auth: authService, building });
};

export const handle: Handle = handleBetterAuth;
