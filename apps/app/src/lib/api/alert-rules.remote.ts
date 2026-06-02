import { command, getRequestEvent, query } from '$app/server';
import {
	createAlertRuleInputSchema,
	deleteAlertRuleInputSchema,
	getAlertRuleInputSchema,
	setAlertRuleEnabledInputSchema,
	updateAlertRuleInputSchema
} from '$lib/server/services/alert-rule.service';
import { z } from 'zod';

export const getAlertRulesQuery = query(z.object({}), () => {
	const event = getRequestEvent();
	return event.locals.container.alertRuleService.getAlertRules({
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});

export const getAlertRuleQuery = query(getAlertRuleInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.alertRuleService.getAlertRule(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});

export const createAlertRuleCommand = command(createAlertRuleInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.alertRuleService.createAlertRule(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!,
		userId: event.locals.auth!.user.id
	});
});

export const updateAlertRuleCommand = command(updateAlertRuleInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.alertRuleService.updateAlertRule(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!,
		userId: event.locals.auth!.user.id
	});
});

export const setAlertRuleEnabledCommand = command(setAlertRuleEnabledInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.alertRuleService.setAlertRuleEnabled(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!,
		userId: event.locals.auth!.user.id
	});
});

export const deleteAlertRuleCommand = command(deleteAlertRuleInputSchema, (input) => {
	const event = getRequestEvent();
	return event.locals.container.alertRuleService.deleteAlertRule(input, {
		organizationId: event.locals.auth!.session.activeOrganizationId!
	});
});
