import { getRequestEvent } from '$app/server';
import { stripe as stripePlugin } from '@better-auth/stripe';
import { type DB } from '@repo/db';
import * as dbSchema from '@repo/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, organization } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { and, eq } from 'drizzle-orm';
import Stripe from 'stripe';
import type { IEmail } from './email';

const createAuth = (config: {
	db: DB;
	email: IEmail;
	secret: string;
	baseUrl: string;
	githubClientId?: string;
	githubClientSecret?: string;
	onOrganizationCreated?: (context: { organizationId: string; userId: string }) => Promise<void>;
	onSubscriptionChanged?: (context: {
		organizationId: string;
		plan: string | null | undefined;
		status: string | null | undefined;
	}) => Promise<void>;
	onBillingNotification?: (context: {
		organizationId: string;
		kind: string;
		payload: Record<string, string>;
	}) => Promise<void>;
	stripe?: {
		client: Stripe;
		webhookSecret: string;
		starterPriceId: string;
		proPriceId: string;
	};
}) => {
	const basePlugins = [
		emailOTP({
			overrideDefaultEmailVerification: true,
			sendVerificationOTP: async ({ email, otp, type }) => {
				if (type !== 'email-verification') {
					return;
				}

				await config.email.sendEmail({
					to: email,
					subject: 'Verify your email',
					template: 'otp',
					props: {
						code: otp,
						purpose: 'sign-up'
					}
				});
			}
		}),
		organization({
			organizationHooks: {
				afterCreateOrganization: async ({ organization, user }) => {
					await config.onOrganizationCreated?.({
						organizationId: organization.id,
						userId: user.id
					});
				}
			}
		})
	] as const;

	const createFreeTrialConfig = () => ({
		days: 14,
		onTrialStart: async (subscription: {
			referenceId: string;
			plan: string;
			status: string;
			trialEnd?: Date;
		}) => {
			await config.onBillingNotification?.({
				organizationId: subscription.referenceId,
				kind: 'trial_started',
				payload: {
					plan: subscription.plan,
					status: subscription.status,
					trialEnd: subscription.trialEnd?.toISOString() ?? ''
				}
			});
		},
		onTrialExpired: async (subscription: {
			referenceId: string;
			plan: string;
			status: string;
			trialEnd?: Date;
		}) => {
			await config.onBillingNotification?.({
				organizationId: subscription.referenceId,
				kind: 'trial_expired',
				payload: {
					plan: subscription.plan,
					status: subscription.status,
					trialEnd: subscription.trialEnd?.toISOString() ?? ''
				}
			});
		}
	});

	const stripePlugins = config.stripe
		? [
				stripePlugin({
					stripeClient: config.stripe.client,
					stripeWebhookSecret: config.stripe.webhookSecret,
					createCustomerOnSignUp: false,
					subscription: {
						enabled: true,
						plans: [
							{
								name: 'starter',
								priceId: config.stripe.starterPriceId,
								freeTrial: createFreeTrialConfig()
							},
							{
								name: 'pro',
								priceId: config.stripe.proPriceId,
								freeTrial: createFreeTrialConfig()
							}
						],
						authorizeReference: async ({ user, referenceId }) => {
							if (!referenceId) {
								return false;
							}

							const currentMember = await config.db.query.member.findFirst({
								where: and(
									eq(dbSchema.member.organizationId, referenceId),
									eq(dbSchema.member.userId, user.id)
								)
							});

							return currentMember?.role === 'owner';
						},
						getCheckoutSessionParams: async () => ({
							params: {
								payment_method_collection: 'if_required',
								subscription_data: {
									trial_settings: {
										end_behavior: {
											missing_payment_method: 'pause'
										}
									}
								}
							}
						}),
						onSubscriptionComplete: async ({ subscription }) => {
							await config.onSubscriptionChanged?.({
								organizationId: subscription.referenceId,
								plan: subscription.plan,
								status: subscription.status
							});
						},
						onSubscriptionUpdate: async ({ subscription }) => {
							await config.onSubscriptionChanged?.({
								organizationId: subscription.referenceId,
								plan: subscription.plan,
								status: subscription.status
							});
						},
						onSubscriptionDeleted: async ({ subscription }) => {
							await config.onSubscriptionChanged?.({
								organizationId: subscription.referenceId,
								plan: subscription.plan,
								status: subscription.status
							});
						}
					},
					onEvent: async (event: Stripe.Event) => {
						if (event.type !== 'customer.subscription.trial_will_end') {
							return;
						}

						const stripeSubscription = event.data.object;
						const organizationId =
							typeof stripeSubscription.metadata?.referenceId === 'string'
								? stripeSubscription.metadata.referenceId
								: typeof stripeSubscription.metadata?.reference_id === 'string'
									? stripeSubscription.metadata.reference_id
									: null;

						if (!organizationId) {
							return;
						}

						await config.onBillingNotification?.({
							organizationId,
							kind: 'trial_will_end',
							payload: {
								stripeSubscriptionId: stripeSubscription.id,
								trialEnd:
									typeof stripeSubscription.trial_end === 'number'
										? new Date(stripeSubscription.trial_end * 1000).toISOString()
										: ''
							}
						});
					},
					organization: {
						enabled: true
					}
				})
			] as const
		: [];

	return betterAuth({
		baseURL: config.baseUrl,
		secret: config.secret,
		database: drizzleAdapter(config.db, { provider: 'pg', schema: dbSchema }),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true
		},
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true
		},
		socialProviders:
			config.githubClientId && config.githubClientSecret
				? {
						github: {
							clientId: config.githubClientId,
							clientSecret: config.githubClientSecret
						}
					}
				: undefined,
		plugins: [...basePlugins, ...stripePlugins, sveltekitCookies(getRequestEvent)]
	});
};

type Auth = ReturnType<typeof createAuth>;
export { createAuth, type Auth };
