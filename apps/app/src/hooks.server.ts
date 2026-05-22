import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { createServerContainer } from '$lib/server/container';
import { svelteKitHandler } from 'better-auth/svelte-kit';

type SessionOrganization = NonNullable<App.Locals['auth']>['organization'];

function readSessionOrganization(session: unknown): SessionOrganization {
	if (!session || typeof session !== 'object') {
		return null;
	}

	const candidate =
		'activeOrganization' in session
			? session.activeOrganization
			: 'organization' in session
				? session.organization
				: null;

	if (!candidate || typeof candidate !== 'object') {
		return null;
	}

	const maybeOrganization = candidate as {
		id?: unknown;
		name?: unknown;
		slug?: unknown;
		logo?: unknown;
	};

	if (
		typeof maybeOrganization.id !== 'string' ||
		typeof maybeOrganization.name !== 'string' ||
		typeof maybeOrganization.slug !== 'string'
	) {
		return null;
	}

	return {
		id: maybeOrganization.id,
		name: maybeOrganization.name,
		slug: maybeOrganization.slug,
		logo: typeof maybeOrganization.logo === 'string' ? maybeOrganization.logo : null
	};
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	event.locals.container = createServerContainer();

	const { authService } = event.locals.container;
	const session = await authService.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.auth = {
			session: session.session,
			user: session.user,
			organization: readSessionOrganization(session)
		};
	}

	return svelteKitHandler({ event, resolve, auth: authService, building });
};

export const handle: Handle = handleBetterAuth;
