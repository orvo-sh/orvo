import type { RequestEvent } from '@sveltejs/kit';

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

	const activeOrganizationId =
		'activeOrganizationId' in auth.session &&
		typeof auth.session.activeOrganizationId === 'string'
			? auth.session.activeOrganizationId
			: null;

	if (!activeOrganizationId) {
		return '/organizations';
	}

	const hasActiveOrganization = organizations.some(
		(organization) => organization.id === activeOrganizationId
	);

	return hasActiveOrganization ? '/' : '/organizations';
};
