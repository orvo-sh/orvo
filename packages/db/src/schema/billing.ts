import { relations } from 'drizzle-orm';
import {
	bigint,
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';

import { organization } from './auth.js';

export const subscription = pgTable(
	'subscription',
	{
		id: text('id').primaryKey(),
		plan: text('plan').notNull(),
		referenceId: text('reference_id').notNull(),
		trialStart: timestamp('trial_start'),
		trialEnd: timestamp('trial_end'),
		stripeCustomerId: text('stripe_customer_id'),
		stripeSubscriptionId: text('stripe_subscription_id'),
		status: text('status').default('incomplete').notNull(),
		periodStart: timestamp('period_start'),
		periodEnd: timestamp('period_end'),
		cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
		cancelAt: timestamp('cancel_at'),
		canceledAt: timestamp('canceled_at'),
		endedAt: timestamp('ended_at'),
		seats: integer('seats'),
		billingInterval: text('billing_interval'),
		stripeScheduleId: text('stripe_schedule_id'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('subscription_reference_id_idx').on(table.referenceId),
		index('subscription_status_idx').on(table.status),
		uniqueIndex('subscription_stripe_subscription_id_uidx').on(table.stripeSubscriptionId)
	]
);

export const organizationBillingProfile = pgTable('organization_billing_profile', {
	organizationId: text('organization_id')
		.primaryKey()
		.references(() => organization.id, { onDelete: 'cascade' }),
	billingEmail: text('billing_email').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const organizationBillingUsage = pgTable(
	'organization_billing_usage',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		signal: text('signal').notNull(),
		periodStart: timestamp('period_start').notNull(),
		periodEnd: timestamp('period_end').notNull(),
		usedBytes: bigint('used_bytes', { mode: 'number' }).notNull().default(0),
		includedBytes: bigint('included_bytes', { mode: 'number' }).notNull().default(0),
		overageBytes: bigint('overage_bytes', { mode: 'number' }).notNull().default(0),
		notified70At: timestamp('notified_70_at'),
		notified85At: timestamp('notified_85_at'),
		notified100At: timestamp('notified_100_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('organization_billing_usage_organization_id_idx').on(table.organizationId),
		uniqueIndex('organization_billing_usage_period_signal_uidx').on(
			table.organizationId,
			table.signal,
			table.periodStart,
			table.periodEnd
		)
	]
);

export const organizationBillingNotification = pgTable(
	'organization_billing_notification',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organization.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		status: text('status').default('pending').notNull(),
		payload: text('payload').notNull(),
		attemptCount: integer('attempt_count').default(0).notNull(),
		nextAttemptAt: timestamp('next_attempt_at').defaultNow().notNull(),
		sentAt: timestamp('sent_at'),
		lastError: text('last_error'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('organization_billing_notification_status_idx').on(table.status),
		index('organization_billing_notification_next_attempt_at_idx').on(table.nextAttemptAt),
		index('organization_billing_notification_organization_id_idx').on(table.organizationId)
	]
);

export const organizationBillingProfileRelations = relations(
	organizationBillingProfile,
	({ one }) => ({
		organization: one(organization, {
			fields: [organizationBillingProfile.organizationId],
			references: [organization.id]
		})
	})
);

export const organizationBillingUsageRelations = relations(organizationBillingUsage, ({ one }) => ({
	organization: one(organization, {
		fields: [organizationBillingUsage.organizationId],
		references: [organization.id]
	})
}));

export const organizationBillingNotificationRelations = relations(
	organizationBillingNotification,
	({ one }) => ({
		organization: one(organization, {
			fields: [organizationBillingNotification.organizationId],
			references: [organization.id]
		})
	})
);
