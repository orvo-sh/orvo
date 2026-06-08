import type { PageServerLoad } from './$types';

export const load = (async ({ locals, params, parent }) => {
	const parentData = await parent();
	const appId = parentData.currentApp?.id ?? params.app_id;

	const result = await locals.container.alertRuleService.getAlertRules({
		appId
	});

	return {
		alertRulesResult: result
	};
}) satisfies PageServerLoad;
