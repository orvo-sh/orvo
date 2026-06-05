import { relations } from 'drizzle-orm';
import { bigint, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { organization } from './organization.schema.js';

const organizationBillingUsage = pgTable(
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

const organizationBillingUsageRelations = relations(organizationBillingUsage, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationBillingUsage.organizationId],
    references: [organization.id]
  })
}));

export { organizationBillingUsage, organizationBillingUsageRelations };
