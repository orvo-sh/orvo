import { command, getRequestEvent } from '$app/server';

import {
	createAppInputSchema,
	updateAppSettingsInputSchema
} from '$lib/server/services/app.service';
import { getActiveOrganizationId, resolveRequestAppContext } from '$lib/server/request-context';
import { err } from '@repo/utils';

export const createAppCommand = command(createAppInputSchema, (input) => {
	const event = getRequestEvent();
	const organizationId = getActiveOrganizationId(event);

	if (!organizationId) {
		return err('No active organization selected.');
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

export const updateAppSettingsCommand = command(updateAppSettingsInputSchema, async (input) => {
	const event = getRequestEvent();
	const appContext = await resolveRequestAppContext(event);

	if (!appContext.success) {
		return err(appContext.error);
	}

	return event.locals.container.appService.updateAppSettings(input, {
		organizationId: appContext.data.organizationId,
		appId: appContext.data.appId,
		userId: event.locals.auth!.user.id
	});
});
