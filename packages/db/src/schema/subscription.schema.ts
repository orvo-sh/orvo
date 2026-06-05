import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

const subscription = pgTable(
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

export { subscription };
