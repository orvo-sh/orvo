import { command, getRequestEvent, query } from '$app/server';
import {
	createIngestionKeyInputSchema,
	getIngestionKeysInputSchema,
	revokeIngestionKeyInputSchema
} from '$lib/server/services/ingestion-key.service';

export const getIngestionKeysQuery = query(getIngestionKeysInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.ingestionKeyService.getIngestionKeys(
		event.locals.auth!.session.activeOrganizationId!,
		input
	);
});

export const createIngestionKeyCommand = command(createIngestionKeyInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.ingestionKeyService.createIngestionKey(
		event.locals.auth!.session.activeOrganizationId!,
		input,
		{
			userId: event.locals.auth!.user.id
		}
	);
});

export const revokeIngestionKeyCommand = command(revokeIngestionKeyInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.ingestionKeyService.revokeIngestionKey(
		event.locals.auth!.session.activeOrganizationId!,
		input
	);
});
