import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (({ url }) => {
	if (!url.searchParams.has('email')) {
		redirect(302, '/');
	}

	return {
		email: url.searchParams.get('email') || ''
	};
}) satisfies PageServerLoad;
