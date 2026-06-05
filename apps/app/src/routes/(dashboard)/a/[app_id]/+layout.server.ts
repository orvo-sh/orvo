import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load = (async ({ locals, params, parent }) => {
	if (!locals.auth) {
		throw redirect(302, '/sign-in');
	}

	const parentData = await parent();
	const organizationId =
		'activeOrganizationId' in locals.auth.session &&
		typeof locals.auth.session.activeOrganizationId === 'string'
			? locals.auth.session.activeOrganizationId
			: null;
	if (!organizationId) {
		throw redirect(302, '/organizations');
	}

	const currentOrganization =
		parentData.organizations.find((organization) => organization.id === organizationId) ?? null;
	if (!currentOrganization) {
		throw redirect(302, '/organizations');
	}

	const accessResult = await locals.container.billingService.getOrganizationAccessState({
		organizationId
	});
	if (!accessResult.success || !accessResult.data.hasAccess) {
		throw redirect(302, '/settings/billing');
	}

	const appsResult = await locals.container.appService.listApps({ organizationId });
	if (!appsResult.success) {
		throw redirect(302, '/apps/new');
	}

	const apps = appsResult.data.apps;
	if (apps.length === 0) {
		throw redirect(302, '/apps/new');
	}

	const currentApp = apps.find((app) => app.id === params.app_id);
	if (!currentApp) {
		throw redirect(302, `/a/${apps[0].id}`);
	}

	const logViewsResult = await locals.container.dashboardLogViewService.getDashboardLogViews({
		appId: currentApp.id
	});

	return {
		apps,
		currentApp,
		currentOrganization,
		logViews: logViewsResult.success ? logViewsResult.data.views : []
	};
}) satisfies LayoutServerLoad;
