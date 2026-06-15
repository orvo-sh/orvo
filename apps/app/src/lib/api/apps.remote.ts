import { command, getRequestEvent } from '$app/server';

import { createAppInputSchema } from '$lib/server/services/app.service';
import { getActiveOrganizationId } from '$lib/server/request-context';
import { err } from '@repo/utils';

export const createAppCommand = command(createAppInputSchema, (input) => {
	const event = getRequestEvent();
	const organizationId = getActiveOrganizationId(event);

	if (!organizationId) {
		return err('No active organization selected.');
	}

	if (!event.locals.container.billingService) {
		return err('Billing is not configured.');
	}

	return event.locals.container.billingService
		.getOrganizationAccessState({ organizationId })
		.then((accessResult) => {
			if (!accessResult.success || !accessResult.data.hasAccess) {
				return err('Activate billing before creating apps.');
			}

			return event.locals.container.appService.createApp(input, {
				organizationId,
				userId: event.locals.auth!.user.id
			});
		});
});
