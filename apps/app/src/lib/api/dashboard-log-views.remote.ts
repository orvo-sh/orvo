import { command, getRequestEvent, query } from '$app/server';
import {
	createDashboardLogViewInputSchema,
	updateDashboardLogViewInputSchema
} from '$lib/server/services/dashboard.service';
import { z } from 'zod';

export const getDashboardLogViewsQuery = query(z.object({}), () => {
	const event = getRequestEvent();
	return event.locals.container.dashboardLogViewService.getDashboardLogViews({
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});

export const createDashboardLogViewCommand = command(createDashboardLogViewInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.dashboardLogViewService.createDashboardLogView(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!,
		userId: event.locals.auth!.user.id
	});
});

export const updateDashboardLogViewCommand = command(updateDashboardLogViewInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.dashboardLogViewService.updateDashboardLogView(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!,
		userId: event.locals.auth!.user.id
	});
});

export const deleteDashboardLogViewCommand = command(z.string().trim().min(1), (id) => {
	const event = getRequestEvent();
	return event.locals.container.dashboardLogViewService.deleteDashboardLogView(id, {
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});
