import type { PageServerLoad } from './$types';

export const load = (async ({ locals, params, parent }) => {
	const parentData = await parent();
	const appId = parentData.currentApp?.id ?? params.app_id;

	const result = await locals.container.deploymentService.listDeployments({ limit: 100 }, { appId });

	return {
		deploymentsResult: result
	};
}) satisfies PageServerLoad;
