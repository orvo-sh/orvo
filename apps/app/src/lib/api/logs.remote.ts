import { getRequestEvent, query } from '$app/server';
import {
	getLogsInputSchema,
	getLogVolumeInputSchema
} from '$lib/server/services/logs.service';
import { getLogFacetsInputSchema } from '$lib/server/services/log-facets.service';

export const getLogsQuery = query(getLogsInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.logsService.getLogs(
		event.locals.auth!.session.activeOrganizationId!,
		input
	);
});

export const getLogVolumeQuery = query(getLogVolumeInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.logsService.getLogVolume(
		event.locals.auth!.session.activeOrganizationId!,
		input
	);
});

export const getLogFacetsQuery = query(getLogFacetsInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.logFacetsService.getLogFacets(
		event.locals.auth!.session.activeOrganizationId!,
		input
	);
});
