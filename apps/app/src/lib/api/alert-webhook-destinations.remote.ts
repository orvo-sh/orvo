import { command, getRequestEvent, query } from '$app/server';
import {
	createAlertWebhookDestinationInputSchema,
	deleteAlertWebhookDestinationInputSchema,
	testAlertWebhookDestinationInputSchema,
	updateAlertWebhookDestinationInputSchema
} from '$lib/server/services/alert-webhook-destination.service';
import { z } from 'zod';

export const getAlertWebhookDestinationsQuery = query(z.object({}), () => {
	const event = getRequestEvent();
	return event.locals.container.alertWebhookDestinationService.getAlertWebhookDestinations({
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});

export const createAlertWebhookDestinationCommand = command(
	createAlertWebhookDestinationInputSchema,
	(input) => {
		const event = getRequestEvent();
		return event.locals.container.alertWebhookDestinationService.createAlertWebhookDestination(input, {
			organizationId: event.locals.auth!.session.activeOrganizationId!,
			userId: event.locals.auth!.user.id
		});
	}
);

export const updateAlertWebhookDestinationCommand = command(
	updateAlertWebhookDestinationInputSchema,
	(input) => {
		const event = getRequestEvent();
		return event.locals.container.alertWebhookDestinationService.updateAlertWebhookDestination(input, {
			organizationId: event.locals.auth!.session.activeOrganizationId!,
			userId: event.locals.auth!.user.id
		});
	}
);

export const deleteAlertWebhookDestinationCommand = command(
	deleteAlertWebhookDestinationInputSchema,
	(input) => {
		const event = getRequestEvent();
		return event.locals.container.alertWebhookDestinationService.deleteAlertWebhookDestination(input, {
			organizationId: event.locals.auth!.session.activeOrganizationId!
		});
	}
);

export const testAlertWebhookDestinationCommand = command(
	testAlertWebhookDestinationInputSchema,
	(input) => {
		const event = getRequestEvent();
		return event.locals.container.alertWebhookDestinationService.testAlertWebhookDestination(input, {
			organizationId: event.locals.auth!.session.activeOrganizationId!
		});
	}
);
