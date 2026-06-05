import { getRequestEvent, query } from '$app/server';
import {
	getLogsInputSchema,
	getLogVolumeInputSchema
} from '$lib/server/services/logs.service';
import { getLogFacetsInputSchema } from '$lib/server/services/log-facets.service';
import { resolveRequestAppContext } from '$lib/server/request-context';
import { err } from '@repo/utils';

export const getLogsQuery = query(getLogsInputSchema, async (input) => {
	const event = getRequestEvent();
	const appContext = await resolveRequestAppContext(event);

	if (!appContext.success) {
		return err(appContext.error);
	}

	return event.locals.container.logsService.getLogs(input, {
		appId: appContext.data.appId
	});
});

export const getLogVolumeQuery = query(getLogVolumeInputSchema, async (input) => {
	const event = getRequestEvent();
	const appContext = await resolveRequestAppContext(event);

	if (!appContext.success) {
		return err(appContext.error);
	}

	return event.locals.container.logsService.getLogVolume(input, {
		appId: appContext.data.appId
	});
});

export const getLogFacetsQuery = query(getLogFacetsInputSchema, async (input) => {
	const event = getRequestEvent();
	const appContext = await resolveRequestAppContext(event);

	if (!appContext.success) {
		return err(appContext.error);
	}

	return event.locals.container.logFacetsService.getLogFacets(input, {
		appId: appContext.data.appId
	});
});
