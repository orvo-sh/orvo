import { redirect } from '@sveltejs/kit';
import { getActiveOrganizationId } from '$lib/server/request-context';
import type { PageServerLoad } from './$types';

export const load = (async (event) => {
	if (!event.locals.auth) {
		throw redirect(302, '/sign-in');
	}

	const organizationId = getActiveOrganizationId(event);
	if (!organizationId) {
		throw redirect(302, '/organizations');
	}

	const accessResult = await event.locals.container.billingService.getOrganizationAccessState({
		organizationId
	});
	if (!accessResult.success || !accessResult.data.hasAccess) {
		throw redirect(302, '/settings/billing');
	}

	const appsResult = await event.locals.container.appService.listApps({ organizationId });

	return {
		hasApps: appsResult.success ? appsResult.data.apps.length > 0 : false
	};
}) satisfies PageServerLoad;
