import { command, getRequestEvent, query } from '$app/server';
import {
	getIngestionKeyInputSchema,
	rotateIngestionKeyInputSchema
} from '$lib/server/services/ingestion-key.service';

export const getIngestionKeyQuery = query(getIngestionKeyInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.ingestionKeyService.getIngestionKey(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});

export const rotateIngestionKeyCommand = command(rotateIngestionKeyInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.ingestionKeyService.rotateIngestionKey(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!,
		userId: event.locals.auth!.user.id
	});
});
