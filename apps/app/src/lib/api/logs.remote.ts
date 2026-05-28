import { getRequestEvent, query } from '$app/server';
import {
	getLogsInputSchema,
	getLogVolumeInputSchema
} from '$lib/server/services/logs.service';
import { getLogFacetsInputSchema } from '$lib/server/services/log-facets.service';

export const getLogsQuery = query(getLogsInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.logsService.getLogs(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});

export const getLogVolumeQuery = query(getLogVolumeInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.logsService.getLogVolume(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});

export const getLogFacetsQuery = query(getLogFacetsInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.logFacetsService.getLogFacets(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});
