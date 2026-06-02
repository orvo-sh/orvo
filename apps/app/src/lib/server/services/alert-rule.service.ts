import type { DB } from '@repo/db';
import {
	alertIncident,
	alertRule,
	alertRuleDestination,
	alertWebhookDestination
} from '@repo/db/schema';
import type { Logger } from '@repo/logger';
import { err, genId, ok } from '@repo/utils';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

class AlertRuleService {
	private logger: Logger;

	constructor(
		private db: DB,
		logger: Logger
	) {
		this.logger = logger.child('AlertRuleService');
	}

	async getAlertRules(context: { organizationId: string }) {
		this.logger.info('getAlertRules: getting alert rules', { context });

		try {
			const rules = await this.db.query.alertRule.findMany({
				where: eq(alertRule.organizationId, context.organizationId),
				orderBy: [desc(alertRule.updatedAt)]
			});

			if (rules.length === 0) {
				return ok({ rules: [] });
			}

			const ruleIds = rules.map((rule) => rule.id);
			const [ruleDestinations, openIncidents] = await Promise.all([
				this.db.query.alertRuleDestination.findMany({
					where: inArray(alertRuleDestination.ruleId, ruleIds)
				}),
				this.db.query.alertIncident.findMany({
					where: and(
						eq(alertIncident.organizationId, context.organizationId),
						eq(alertIncident.status, 'open')
					),
					orderBy: [desc(alertIncident.openedAt)]
				})
			]);
			const destinationCountByRuleId = new Map<string, number>();
			const openIncidentByRuleId = new Map(openIncidents.map((incident) => [incident.ruleId, incident]));

			for (const destination of ruleDestinations) {
				destinationCountByRuleId.set(
					destination.ruleId,
					(destinationCountByRuleId.get(destination.ruleId) ?? 0) + 1
				);
			}

			return ok({
				rules: rules.map((rule) => ({
					...rule,
					destinationCount: destinationCountByRuleId.get(rule.id) ?? 0,
					openIncident: openIncidentByRuleId.get(rule.id) ?? null
				}))
			});
		} catch (error) {
			this.logger.error('getAlertRules: failed to get alert rules', error);
			return err('Failed to get alert rules.');
		}
	}

	async getAlertRule(input: z.infer<typeof getAlertRuleInputSchema>, context: { organizationId: string }) {
		this.logger.info('getAlertRule: getting alert rule', { input, context });

		const validated = getAlertRuleInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const rule = await this.db.query.alertRule.findFirst({
				where: and(
					eq(alertRule.id, validated.data),
					eq(alertRule.organizationId, context.organizationId)
				)
			});

			if (!rule) {
				return err('Alert rule not found.');
			}

			const destinations = await this.db.query.alertRuleDestination.findMany({
				where: eq(alertRuleDestination.ruleId, rule.id),
				orderBy: [asc(alertRuleDestination.destinationId)]
			});

			return ok({
				rule: {
					...rule,
					destinationIds: destinations.map((destination) => destination.destinationId)
				}
			});
		} catch (error) {
			this.logger.error('getAlertRule: failed to get alert rule', error);
			return err('Failed to get alert rule.');
		}
	}

	async createAlertRule(
		input: z.infer<typeof createAlertRuleInputSchema>,
		context: { organizationId: string; userId: string }
	) {
		this.logger.info('createAlertRule: creating alert rule', { input, context });

		const validated = createAlertRuleInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		const ruleValidationError = validateRuleConfig(validated.data);
		if (ruleValidationError) {
			return err(ruleValidationError);
		}

		try {
			const destinationIds = uniqueValues(validated.data.destinationIds);
			const destinations =
				destinationIds.length === 0
					? []
					: await this.db.query.alertWebhookDestination.findMany({
							where: and(
								eq(alertWebhookDestination.organizationId, context.organizationId),
								inArray(alertWebhookDestination.id, destinationIds)
							),
							orderBy: [asc(alertWebhookDestination.name)]
						});

			if (destinations.length !== destinationIds.length) {
				return err('One or more destinations could not be found.');
			}

			const id = genId('alrt');

			await this.db.transaction(async (tx) => {
				await tx.insert(alertRule).values({
					id,
					organizationId: context.organizationId,
					name: validated.data.name,
					signalType: validated.data.signalType,
					comparator: validated.data.comparator,
					threshold: validated.data.threshold,
					windowMinutes: validated.data.windowMinutes,
					renotifyMinutes: validated.data.renotifyMinutes,
					apdexTargetMs: validated.data.apdexTargetMs,
					scopeServicesInclude: validated.data.scope.services.include,
					scopeServicesExclude: validated.data.scope.services.exclude,
					scopeSpanNamesInclude: validated.data.scope.spanNames.include,
					scopeSpanNamesExclude: validated.data.scope.spanNames.exclude,
					scopeEnvironmentsInclude: validated.data.scope.environments.include,
					scopeEnvironmentsExclude: validated.data.scope.environments.exclude,
					scopeScopesInclude: validated.data.scope.scopes.include,
					scopeScopesExclude: validated.data.scope.scopes.exclude,
					createdBy: context.userId,
					updatedBy: context.userId
				});

				if (destinationIds.length > 0) {
					await tx.insert(alertRuleDestination).values(
						destinationIds.map((destinationId) => ({
							ruleId: id,
							destinationId
						}))
					);
				}
			});

			return ok({ id });
		} catch (error) {
			this.logger.error('createAlertRule: failed to create alert rule', error);
			return err('Failed to create alert rule.');
		}
	}

	async updateAlertRule(
		input: z.infer<typeof updateAlertRuleInputSchema>,
		context: { organizationId: string; userId: string }
	) {
		this.logger.info('updateAlertRule: updating alert rule', { input, context });

		const validated = updateAlertRuleInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		const ruleValidationError = validateRuleConfig(validated.data);
		if (ruleValidationError) {
			return err(ruleValidationError);
		}

		try {
			const existing = await this.db.query.alertRule.findFirst({
				where: and(
					eq(alertRule.id, validated.data.id),
					eq(alertRule.organizationId, context.organizationId)
				)
			});

			if (!existing) {
				return err('Alert rule not found.');
			}

			const destinationIds = uniqueValues(validated.data.destinationIds);
			const destinations =
				destinationIds.length === 0
					? []
					: await this.db.query.alertWebhookDestination.findMany({
							where: and(
								eq(alertWebhookDestination.organizationId, context.organizationId),
								inArray(alertWebhookDestination.id, destinationIds)
							),
							orderBy: [asc(alertWebhookDestination.name)]
						});

			if (destinations.length !== destinationIds.length) {
				return err('One or more destinations could not be found.');
			}

			await this.db.transaction(async (tx) => {
				await tx
					.update(alertRule)
					.set({
						name: validated.data.name,
						signalType: validated.data.signalType,
						comparator: validated.data.comparator,
						threshold: validated.data.threshold,
						windowMinutes: validated.data.windowMinutes,
						renotifyMinutes: validated.data.renotifyMinutes,
						apdexTargetMs: validated.data.apdexTargetMs,
						scopeServicesInclude: validated.data.scope.services.include,
						scopeServicesExclude: validated.data.scope.services.exclude,
						scopeSpanNamesInclude: validated.data.scope.spanNames.include,
						scopeSpanNamesExclude: validated.data.scope.spanNames.exclude,
						scopeEnvironmentsInclude: validated.data.scope.environments.include,
						scopeEnvironmentsExclude: validated.data.scope.environments.exclude,
						scopeScopesInclude: validated.data.scope.scopes.include,
						scopeScopesExclude: validated.data.scope.scopes.exclude,
						updatedBy: context.userId,
						nextEvaluationAt: new Date(),
						evaluationLeaseToken: null,
						evaluationLeaseExpiresAt: null
					})
					.where(eq(alertRule.id, existing.id));

				await tx.delete(alertRuleDestination).where(eq(alertRuleDestination.ruleId, existing.id));

				if (destinationIds.length > 0) {
					await tx.insert(alertRuleDestination).values(
						destinationIds.map((destinationId) => ({
							ruleId: existing.id,
							destinationId
						}))
					);
				}
			});

			return ok(undefined);
		} catch (error) {
			this.logger.error('updateAlertRule: failed to update alert rule', error);
			return err('Failed to update alert rule.');
		}
	}

	async setAlertRuleEnabled(
		input: z.infer<typeof setAlertRuleEnabledInputSchema>,
		context: { organizationId: string; userId: string }
	) {
		this.logger.info('setAlertRuleEnabled: updating alert rule enabled state', { input, context });

		const validated = setAlertRuleEnabledInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			const existing = await this.db.query.alertRule.findFirst({
				where: and(
					eq(alertRule.id, validated.data.id),
					eq(alertRule.organizationId, context.organizationId)
				)
			});

			if (!existing) {
				return err('Alert rule not found.');
			}

			await this.db.transaction(async (tx) => {
				await tx
					.update(alertRule)
					.set({
						isEnabled: validated.data.isEnabled,
						updatedBy: context.userId,
						nextEvaluationAt: new Date(),
						evaluationLeaseToken: null,
						evaluationLeaseExpiresAt: null
					})
					.where(eq(alertRule.id, existing.id));

				if (!validated.data.isEnabled) {
					await tx
						.update(alertIncident)
						.set({
							status: 'resolved',
							resolvedAt: new Date()
						})
						.where(
							and(
								eq(alertIncident.ruleId, existing.id),
								eq(alertIncident.organizationId, context.organizationId),
								eq(alertIncident.status, 'open')
							)
						);
				}
			});

			return ok(undefined);
		} catch (error) {
			this.logger.error('setAlertRuleEnabled: failed to update alert rule enabled state', error);
			return err('Failed to update alert rule.');
		}
	}

	async deleteAlertRule(input: z.infer<typeof deleteAlertRuleInputSchema>, context: { organizationId: string }) {
		this.logger.info('deleteAlertRule: deleting alert rule', { input, context });

		const validated = deleteAlertRuleInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			await this.db
				.delete(alertRule)
				.where(
					and(
						eq(alertRule.id, validated.data),
						eq(alertRule.organizationId, context.organizationId)
					)
				);

			return ok(undefined);
		} catch (error) {
			this.logger.error('deleteAlertRule: failed to delete alert rule', error);
			return err('Failed to delete alert rule.');
		}
	}

	async seedDefaultAlertRules(context: { organizationId: string; userId: string }) {
		this.logger.info('seedDefaultAlertRules: seeding default alert rules', { context });

		try {
			const existingRule = await this.db.query.alertRule.findFirst({
				where: eq(alertRule.organizationId, context.organizationId)
			});

			if (existingRule) {
				return ok(undefined);
			}

			await this.db.insert(alertRule).values(
				defaultAlertRules.map((rule) => ({
					id: genId('alrt'),
					organizationId: context.organizationId,
					name: rule.name,
					signalType: rule.signalType,
					comparator: rule.comparator,
					threshold: rule.threshold,
					windowMinutes: rule.windowMinutes,
					renotifyMinutes: rule.renotifyMinutes,
					apdexTargetMs: rule.apdexTargetMs,
					scopeServicesInclude: [],
					scopeServicesExclude: [],
					scopeSpanNamesInclude: [],
					scopeSpanNamesExclude: [],
					scopeEnvironmentsInclude: [],
					scopeEnvironmentsExclude: [],
					scopeScopesInclude: [],
					scopeScopesExclude: [],
					createdBy: context.userId,
					updatedBy: context.userId
				}))
			);

			return ok(undefined);
		} catch (error) {
			this.logger.error('seedDefaultAlertRules: failed to seed default alert rules', error);
			return err('Failed to seed default alert rules.');
		}
	}
}

const alertIdSchema = z.string().trim().min(1);

const alertScopeArraySchema = z.array(z.string().trim().min(1).max(255)).max(50).default([]);

const alertScopeInputSchema = z.object({
	services: z
		.object({
			include: alertScopeArraySchema,
			exclude: alertScopeArraySchema
		})
		.default({ include: [], exclude: [] }),
	spanNames: z
		.object({
			include: alertScopeArraySchema,
			exclude: alertScopeArraySchema
		})
		.default({ include: [], exclude: [] }),
	environments: z
		.object({
			include: alertScopeArraySchema,
			exclude: alertScopeArraySchema
		})
		.default({ include: [], exclude: [] }),
	scopes: z
		.object({
			include: alertScopeArraySchema,
			exclude: alertScopeArraySchema
		})
		.default({ include: [], exclude: [] })
});

const alertRuleInputSchema = z.object({
	name: z.string().trim().min(1).max(64),
	signalType: z.enum([
		'error_rate',
		'latency_p95_ms',
		'latency_p99_ms',
		'apdex',
		'throughput_per_min',
		'availability_percent'
	]),
	comparator: z.enum(['gt', 'gte', 'lt', 'lte']),
	threshold: z.number().finite(),
	windowMinutes: z.number().int().min(1).max(1440),
	renotifyMinutes: z.number().int().min(1).max(10080).nullable().default(null),
	apdexTargetMs: z.number().int().min(1).max(600000).nullable().default(null),
	scope: alertScopeInputSchema,
	destinationIds: z.array(alertIdSchema).max(50).default([])
});

const getAlertRuleInputSchema = alertIdSchema;

const createAlertRuleInputSchema = alertRuleInputSchema;

const updateAlertRuleInputSchema = alertRuleInputSchema.extend({
	id: alertIdSchema
});

const setAlertRuleEnabledInputSchema = z.object({
	id: alertIdSchema,
	isEnabled: z.boolean()
});

const deleteAlertRuleInputSchema = alertIdSchema;

const validateRuleConfig = (input: z.infer<typeof alertRuleInputSchema>) => {
	if (input.signalType === 'apdex' && !input.apdexTargetMs) {
		return 'Apdex rules require an apdex target.';
	}

	if (input.signalType !== 'apdex' && input.apdexTargetMs) {
		return 'Only apdex rules can set an apdex target.';
	}

	if (
		(input.signalType === 'error_rate' ||
			input.signalType === 'availability_percent' ||
			input.signalType === 'apdex') &&
		(input.threshold < 0 || input.threshold > 100)
	) {
		return 'This signal expects a threshold between 0 and 100.';
	}

	return null;
};

const uniqueValues = (values: string[]) => Array.from(new Set(values));

const defaultAlertRules = [
	{
		name: 'High error rate',
		signalType: 'error_rate',
		comparator: 'gt',
		threshold: 5,
		windowMinutes: 5,
		renotifyMinutes: 15,
		apdexTargetMs: null
	},
	{
		name: 'High p95 latency',
		signalType: 'latency_p95_ms',
		comparator: 'gt',
		threshold: 1000,
		windowMinutes: 15,
		renotifyMinutes: 30,
		apdexTargetMs: null
	},
	{
		name: 'High p99 latency',
		signalType: 'latency_p99_ms',
		comparator: 'gt',
		threshold: 2000,
		windowMinutes: 15,
		renotifyMinutes: 30,
		apdexTargetMs: null
	},
	{
		name: 'Low apdex',
		signalType: 'apdex',
		comparator: 'lt',
		threshold: 0.9,
		windowMinutes: 15,
		renotifyMinutes: 30,
		apdexTargetMs: 300
	}
] as const;

export {
	AlertRuleService,
	createAlertRuleInputSchema,
	deleteAlertRuleInputSchema,
	getAlertRuleInputSchema,
	setAlertRuleEnabledInputSchema,
	updateAlertRuleInputSchema
};
