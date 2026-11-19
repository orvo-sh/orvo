import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, params, parent }) => {
  const parentData = await parent();
  if (!parentData.currentApp) {
    error(404, "App not found.");
  }

  const [ruleResult, destinationsResult, onboardingResult] = await Promise.all([
    locals.container.alertRuleService.getAlertRule(params.rule_id, {
      appId: params.app_id,
    }),
    locals.container.notificationDestinationService.listNotificationDestinations(
      {
        appId: params.app_id,
      },
    ),
    locals.container.onboardingService.getOnboardingProgress({
      userId: locals.auth!.user.id,
    }),
  ]);

  if (!ruleResult.success) {
    error(
      ruleResult.error === "Alert rule not found." ? 404 : 500,
      ruleResult.error,
    );
  }

  if (!destinationsResult.success) {
    error(500, destinationsResult.error);
  }

  if (!onboardingResult.success) error(500, onboardingResult.error);

  return {
    hasCreatedAlertRule: onboardingResult.data.milestones.includes(
      "first_alert_rule_created",
    ),
    rule: ruleResult.data.rule,
    destinations: destinationsResult.data.destinations,
  };
}) satisfies PageServerLoad;
