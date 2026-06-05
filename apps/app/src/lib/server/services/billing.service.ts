import { billingPlanConfig, billingSignals, billingStatusHasAccess, getIncludedBytesForPlan } from '$lib/billing';
import type { Auth } from '$lib/server/auth';
import type { DB } from '@repo/db';
import {
	entitlement,
	member,
	organization,
	organizationBillingNotification,
	organizationBillingProfile,
	organizationBillingUsage,
	subscription,
	user
} from '@repo/db/schema';
import type { Logger } from '@repo/logger';
import { err, genId, ok } from '@repo/utils';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import Stripe from 'stripe';
import { z } from 'zod';

class BillingService {
	private logger: Logger;

	constructor(
		private db: DB,
		logger: Logger,
		private stripeClient: Stripe | null,
		private salesEmail: string
	) {
		this.logger = logger.child('BillingService');
	}

	async getBillingState(context: { organizationId: string; userId: string }) {
		this.logger.info('getBillingState: fetching billing state', { context });

		try {
			const [isOwner, profile, currentSubscription, currentEntitlement] = await Promise.all([
				this.isOrganizationOwner(context.organizationId, context.userId),
				this.db.query.organizationBillingProfile.findFirst({
					where: eq(organizationBillingProfile.organizationId, context.organizationId)
				}),
				this.getCurrentSubscription(context.organizationId),
				this.db.query.entitlement.findFirst({
					where: eq(entitlement.organizationId, context.organizationId)
				})
			]);

			const usageRows =
				currentSubscription?.periodStart && currentSubscription?.periodEnd
					? await this.db.query.organizationBillingUsage.findMany({
							where: and(
								eq(organizationBillingUsage.organizationId, context.organizationId),
								eq(organizationBillingUsage.periodStart, currentSubscription.periodStart),
								eq(organizationBillingUsage.periodEnd, currentSubscription.periodEnd)
							)
						})
					: [];

			const planKey = resolvePlanKey(currentSubscription?.plan, currentSubscription?.status);
			const usage = billingSignals.map((signal) => {
				const row = usageRows.find((candidate) => candidate.signal === signal);
				const includedBytes = row?.includedBytes ?? getIncludedBytesForPlan(planKey, signal);
				const usedBytes = row?.usedBytes ?? 0;
				const overageBytes = row?.overageBytes ?? 0;
				const usagePercent =
					includedBytes > 0 ? Math.min(Math.round((usedBytes / includedBytes) * 100), 100) : 0;

				return {
					signal,
					includedBytes,
					usedBytes,
					overageBytes,
					usagePercent
				};
			});

			return ok({
				isOwner,
				salesEmail: this.salesEmail,
				billingEmail: profile?.billingEmail ?? null,
				subscription: currentSubscription
					? {
							plan: currentSubscription.plan,
							status: currentSubscription.status,
							trialStart: currentSubscription.trialStart,
							trialEnd: currentSubscription.trialEnd,
							periodStart: currentSubscription.periodStart,
							periodEnd: currentSubscription.periodEnd,
							cancelAtPeriodEnd: currentSubscription.cancelAtPeriodEnd
						}
					: null,
				entitlements: {
					planKey: currentEntitlement?.planKey ?? 'none',
					source: currentEntitlement?.source ?? 'default'
				},
				plans: [billingPlanConfig.starter, billingPlanConfig.pro, billingPlanConfig.enterprise],
				usage
			});
		} catch (error) {
			this.logger.error('getBillingState: failed to fetch billing state', error as Error);
			return err('Failed to load billing state.');
		}
	}

	async getOrganizationAccessState(context: { organizationId: string }) {
		this.logger.info('getOrganizationAccessState: checking organization access', { context });

		try {
			const currentSubscription = await this.getCurrentSubscription(context.organizationId);

			return ok({
				hasAccess: billingStatusHasAccess(currentSubscription?.status),
				subscription: currentSubscription
			});
		} catch (error) {
			this.logger.error(
				'getOrganizationAccessState: failed to check organization access',
				error as Error
			);
			return err('Failed to check billing access.');
		}
	}

	async startOrganizationTrial(
		input: z.infer<typeof startOrganizationTrialInputSchema>,
		context: {
			organizationId: string;
			userId: string;
			headers: Headers;
			origin: string;
			authService: Auth;
		}
	) {
		this.logger.info('startOrganizationTrial: starting organization trial', { input, context });

		const validated = startOrganizationTrialInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			if (!(await this.isOrganizationOwner(context.organizationId, context.userId))) {
				return err('Only organization owners can manage billing.');
			}

			const currentSubscription = await this.getCurrentSubscription(context.organizationId);
			if (currentSubscription && billingStatusHasAccess(currentSubscription.status)) {
				return err('This organization already has an active subscription.');
			}

			if (await this.hasUserConsumedTrial(context.userId)) {
				return err('You have already used your free trial.');
			}

			const successUrl = new URL('/settings/billing?checkout=success', context.origin).toString();
			const cancelUrl = new URL('/settings/billing?checkout=cancelled', context.origin).toString();
			const returnUrl = new URL('/settings/billing', context.origin).toString();

			const result = await (context.authService.api as any).upgradeSubscription({
				body: {
					plan: validated.data.plan,
					customerType: 'organization',
					referenceId: context.organizationId,
					successUrl,
					cancelUrl,
					returnUrl,
					disableRedirect: true
				},
				headers: context.headers
			});

			const checkoutUrl = readRedirectUrl(result);
			if (!checkoutUrl) {
				return err('Failed to start the free trial.');
			}

			return ok({ url: checkoutUrl });
		} catch (error) {
			this.logger.error('startOrganizationTrial: failed to start organization trial', error as Error);
			return err('Failed to start the free trial.');
		}
	}

	async createBillingPortalSession(
		_contextInput: z.infer<typeof createBillingPortalInputSchema>,
		context: {
			organizationId: string;
			userId: string;
			headers: Headers;
			origin: string;
			authService: Auth;
		}
	) {
		this.logger.info('createBillingPortalSession: creating billing portal session', { context });

		try {
			if (!(await this.isOrganizationOwner(context.organizationId, context.userId))) {
				return err('Only organization owners can manage billing.');
			}

			const returnUrl = new URL('/settings/billing', context.origin).toString();
			const result = await (context.authService.api as any).createBillingPortal({
				body: {
					customerType: 'organization',
					referenceId: context.organizationId,
					returnUrl,
					disableRedirect: true
				},
				headers: context.headers
			});

			const portalUrl = readRedirectUrl(result);
			if (!portalUrl) {
				return err('Failed to open billing management.');
			}

			return ok({ url: portalUrl });
		} catch (error) {
			this.logger.error(
				'createBillingPortalSession: failed to create billing portal session',
				error as Error
			);
			return err('Failed to open billing management.');
		}
	}

	async updateBillingEmail(
		input: z.infer<typeof updateBillingEmailInputSchema>,
		context: { organizationId: string; userId: string }
	) {
		this.logger.info('updateBillingEmail: updating billing email', { input, context });

		const validated = updateBillingEmailInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			if (!(await this.isOrganizationOwner(context.organizationId, context.userId))) {
				return err('Only organization owners can manage billing.');
			}

			const currentOrganization = await this.db.query.organization.findFirst({
				where: eq(organization.id, context.organizationId)
			});
			if (!currentOrganization) {
				return err('Organization not found.');
			}

			await this.db
				.insert(organizationBillingProfile)
				.values({
					organizationId: context.organizationId,
					billingEmail: validated.data.billingEmail
				})
				.onConflictDoUpdate({
					target: organizationBillingProfile.organizationId,
					set: {
						billingEmail: validated.data.billingEmail
					}
				});

			if (this.stripeClient && currentOrganization.stripeCustomerId) {
				await this.stripeClient.customers.update(currentOrganization.stripeCustomerId, {
					email: validated.data.billingEmail
				});
			}

			return ok(undefined);
		} catch (error) {
			this.logger.error('updateBillingEmail: failed to update billing email', error as Error);
			return err('Failed to update billing email.');
		}
	}

	async handleOrganizationCreated(context: { organizationId: string; userId: string }) {
		this.logger.info('handleOrganizationCreated: bootstrapping billing state', { context });

		try {
			const [createdOrganization, createdByUser] = await Promise.all([
				this.db.query.organization.findFirst({
					where: eq(organization.id, context.organizationId)
				}),
				this.db.query.user.findFirst({
					where: eq(user.id, context.userId)
				})
			]);

			if (!createdOrganization || !createdByUser) {
				return;
			}

			await this.db
				.insert(organizationBillingProfile)
				.values({
					organizationId: context.organizationId,
					billingEmail: createdByUser.email
				})
				.onConflictDoNothing();

			await this.syncEntitlementsForOrganization({
				organizationId: context.organizationId,
				plan: 'none',
				status: 'inactive'
			});

			if (!this.stripeClient || createdOrganization.stripeCustomerId) {
				return;
			}

			const stripeCustomer = await this.stripeClient.customers.create({
				name: createdOrganization.name,
				email: createdByUser.email,
				metadata: {
					organizationId: createdOrganization.id
				}
			});

			await this.db
				.update(organization)
				.set({
					stripeCustomerId: stripeCustomer.id
				})
				.where(eq(organization.id, createdOrganization.id));
		} catch (error) {
			this.logger.error(
				'handleOrganizationCreated: failed to bootstrap billing state',
				error as Error
			);
			throw error;
		}
	}

	async syncEntitlementsForOrganization(input: {
		organizationId: string;
		plan: string | null | undefined;
		status: string | null | undefined;
	}) {
		this.logger.info('syncEntitlementsForOrganization: syncing entitlements', { input });

		try {
			const planKey = resolvePlanKey(input.plan, input.status);
			const plan = billingPlanConfig[planKey];

			await this.db
				.insert(entitlement)
				.values({
					organizationId: input.organizationId,
					planKey,
					source: 'billing',
					logsRetentionDays: plan.retentionDays.logs,
					tracesRetentionDays: plan.retentionDays.traces,
					metricsRetentionDays: plan.retentionDays.metrics,
					logsMaxIngestBytesPerPeriod: getIncludedBytesForPlan(planKey, 'logs'),
					tracesMaxIngestBytesPerPeriod: getIncludedBytesForPlan(planKey, 'traces'),
					metricsMaxIngestBytesPerPeriod: getIncludedBytesForPlan(planKey, 'metrics')
				})
				.onConflictDoUpdate({
					target: entitlement.organizationId,
					set: {
						planKey,
						source: 'billing',
						logsRetentionDays: plan.retentionDays.logs,
						tracesRetentionDays: plan.retentionDays.traces,
						metricsRetentionDays: plan.retentionDays.metrics,
						logsMaxIngestBytesPerPeriod: getIncludedBytesForPlan(planKey, 'logs'),
						tracesMaxIngestBytesPerPeriod: getIncludedBytesForPlan(planKey, 'traces'),
						metricsMaxIngestBytesPerPeriod: getIncludedBytesForPlan(planKey, 'metrics')
					}
				});
		} catch (error) {
			this.logger.error(
				'syncEntitlementsForOrganization: failed to sync entitlements',
				error as Error
			);
			throw error;
		}
	}

	async queueNotification(
		input: z.infer<typeof queueBillingNotificationInputSchema>,
		context: { organizationId: string }
	) {
		this.logger.info('queueNotification: queuing billing notification', { input, context });

		const validated = queueBillingNotificationInputSchema.safeParse(input);
		if (!validated.success) {
			return err(validated.error.message);
		}

		try {
			await this.db.insert(organizationBillingNotification).values({
				id: genId('bntf'),
				organizationId: context.organizationId,
				kind: validated.data.kind,
				payload: JSON.stringify(validated.data.payload)
			});

			return ok(undefined);
		} catch (error) {
			this.logger.error('queueNotification: failed to queue billing notification', error as Error);
			return err('Failed to queue billing notification.');
		}
	}

	private async isOrganizationOwner(organizationId: string, userId: string) {
		const currentMember = await this.db.query.member.findFirst({
			where: and(eq(member.organizationId, organizationId), eq(member.userId, userId))
		});

		return currentMember?.role === 'owner';
	}

	private async getCurrentSubscription(organizationId: string) {
		const subscriptions = await this.db.query.subscription.findMany({
			where: eq(subscription.referenceId, organizationId),
			orderBy: [desc(subscription.periodEnd), desc(subscription.trialEnd)]
		});

		return (
			subscriptions.find((candidate) =>
				['active', 'trialing', 'paused', 'past_due', 'unpaid', 'incomplete'].includes(
					candidate.status
				)
			) ??
			subscriptions[0] ??
			null
		);
	}

	private async hasUserConsumedTrial(userId: string) {
		const existingTrial = await this.db
			.select({ subscriptionId: subscription.id })
			.from(subscription)
			.innerJoin(member, eq(member.organizationId, subscription.referenceId))
			.where(and(eq(member.userId, userId), isNotNull(subscription.trialStart)))
			.limit(1);

		return existingTrial.length > 0;
	}
}

const getBillingStateInputSchema = z.object({});

const startOrganizationTrialInputSchema = z.object({
	plan: z.enum(['starter', 'pro'])
});

const createBillingPortalInputSchema = z.object({});

const updateBillingEmailInputSchema = z.object({
	billingEmail: z.string().trim().email().max(255)
});

const queueBillingNotificationInputSchema = z.object({
	kind: z.string().trim().min(1).max(64),
	payload: z.record(z.string(), z.string())
});

const resolvePlanKey = (
	plan: string | null | undefined,
	status: string | null | undefined
): 'none' | 'starter' | 'pro' => {
	if (!billingStatusHasAccess(status)) {
		return 'none';
	}

	return plan === 'pro' ? 'pro' : plan === 'starter' ? 'starter' : 'none';
};

const readRedirectUrl = (result: unknown) => {
	if (typeof result !== 'object' || result === null) {
		return null;
	}

	if ('url' in result && typeof result.url === 'string') {
		return result.url;
	}

	if (
		'data' in result &&
		typeof result.data === 'object' &&
		result.data !== null &&
		'url' in result.data &&
		typeof result.data.url === 'string'
	) {
		return result.data.url;
	}

	return null;
};

export {
	BillingService,
	getBillingStateInputSchema,
	createBillingPortalInputSchema,
	queueBillingNotificationInputSchema,
	startOrganizationTrialInputSchema,
	updateBillingEmailInputSchema
};
