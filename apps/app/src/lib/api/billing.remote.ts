import { command, getRequestEvent, query } from '$app/server';
import {
	createBillingPortalInputSchema,
	getBillingStateInputSchema,
	startOrganizationTrialInputSchema,
	updateBillingEmailInputSchema
} from '$lib/server/services/billing.service';
import { getActiveOrganizationId } from '$lib/server/request-context';
import { err } from '@repo/utils';

export const getBillingStateQuery = query(getBillingStateInputSchema, async () => {
	const event = getRequestEvent();
	const organizationId = getActiveOrganizationId(event);

	if (!organizationId) {
		return err('No active organization selected.');
	}

	return event.locals.container.billingService.getBillingState({
		organizationId,
		userId: event.locals.auth!.user.id
	});
});

export const startOrganizationTrialCommand = command(
	startOrganizationTrialInputSchema,
	(input) => {
		const event = getRequestEvent();
		const organizationId = getActiveOrganizationId(event);

		if (!organizationId) {
			return err('No active organization selected.');
		}

		return event.locals.container.billingService.startOrganizationTrial(input, {
			organizationId,
			userId: event.locals.auth!.user.id,
			headers: event.request.headers,
			origin: event.url.origin,
			authService: event.locals.container.authService
		});
	}
);

export const createBillingPortalCommand = command(createBillingPortalInputSchema, () => {
	const event = getRequestEvent();
	const organizationId = getActiveOrganizationId(event);

	if (!organizationId) {
		return err('No active organization selected.');
	}

	return event.locals.container.billingService.createBillingPortalSession({}, {
		organizationId,
		userId: event.locals.auth!.user.id,
		headers: event.request.headers,
		origin: event.url.origin,
		authService: event.locals.container.authService
	});
});

export const updateBillingEmailCommand = command(updateBillingEmailInputSchema, (input) => {
	const event = getRequestEvent();
	const organizationId = getActiveOrganizationId(event);

	if (!organizationId) {
		return err('No active organization selected.');
	}

	return event.locals.container.billingService.updateBillingEmail(input, {
		organizationId,
		userId: event.locals.auth!.user.id
	});
});
