import { getRequestEvent, query } from '$app/server';
import { getTraceInputSchema, getTracesInputSchema } from '$lib/server/services/traces.service';

export const getTracesQuery = query(getTracesInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.tracesService.getTraces(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});

export const getTraceQuery = query(getTraceInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.tracesService.getTrace(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});
