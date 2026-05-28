import { building } from '$app/environment';
import { createServerContainer } from '$lib/server/container';
import { Logger } from '$lib/server/observability/logger';
import { genId } from '$lib/utils/gen-id';
import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const baseLogger = new Logger('Orvo', { pretty: !building });

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const startTime = Date.now();
	const requestId = genId('req');
	const logger = baseLogger.child('Orvo', {
		requestId,
		method: event.request.method,
		url: event.url.pathname
	});

	event.locals.container = createServerContainer(logger);
	event.tracing.root.setAttribute('orvo.request_id', requestId);
	event.tracing.root.setAttribute('http.request.method', event.request.method);
	event.tracing.root.setAttribute('url.path', event.url.pathname);

	const { authService } = event.locals.container;
	const session = await authService.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.auth = {
			session: session.session,
			user: session.user,
		};
	}

	const response = await svelteKitHandler({ event, resolve, auth: authService, building });

	logger.info('HTTP request handled', {
		method: event.request.method,
		url: event.url.pathname,
		status: response.status,
		duration: `${Date.now() - startTime}ms`
	});

	return response;
};

export const handle: Handle = handleBetterAuth;
