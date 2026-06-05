import type { RequestEvent } from '@sveltejs/kit';
import { getActiveOrganizationId } from './request-context';

export const getVerifyEmailRedirect = (email: string) =>
	`/verify-email?email=${encodeURIComponent(email)}`;

export const getAuthenticatedRedirect = async (event: RequestEvent) => {
	const auth = event.locals.auth;

	if (!auth) {
		return '/sign-in';
	}

	if (!auth.user.emailVerified) {
		return getVerifyEmailRedirect(auth.user.email);
	}

	const organizations = await event.locals.container.authService.api.listOrganizations({
		headers: event.request.headers
	});

	if (organizations.length === 0) {
		return '/organizations/new';
	}

	const activeOrganizationId = getActiveOrganizationId(event);

	if (!activeOrganizationId) {
		return '/organizations';
	}

	const hasActiveOrganization = organizations.some(
		(organization) => organization.id === activeOrganizationId
	);

	if (!hasActiveOrganization) {
		return '/organizations';
	}

	const accessResult = await event.locals.container.billingService.getOrganizationAccessState({
		organizationId: activeOrganizationId
	});
	if (!accessResult.success || !accessResult.data.hasAccess) {
		return '/settings/billing';
	}

	const appsResult = await event.locals.container.appService.listApps({
		organizationId: activeOrganizationId
	});
	if (!appsResult.success) {
		return '/apps/new';
	}

	const firstApp = appsResult.data.apps[0];
	return firstApp ? `/a/${firstApp.id}` : '/apps/new';
};
