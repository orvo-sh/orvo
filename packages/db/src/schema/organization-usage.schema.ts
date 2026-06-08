import { relations } from 'drizzle-orm';
import { bigint, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { organization } from './organization.schema.js';

const organizationUsage = pgTable(
  'organization_usage',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    logsRetentionDays: integer('logs_retention_days').notNull(),
    tracesRetentionDays: integer('traces_retention_days').notNull(),
    metricsRetentionDays: integer('metrics_retention_days').notNull(),
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    logsIngestedBytes: bigint('logs_ingested_bytes', { mode: 'number' })
      .notNull()
      .default(0),
    tracesIngestedBytes: bigint('traces_ingested_bytes', { mode: 'number' })
      .notNull()
      .default(0),
    metricsIngestedBytes: bigint('metrics_ingested_bytes', { mode: 'number' })
      .notNull()
      .default(0),
    ingestLimitBytes: bigint('ingest_limit_bytes', { mode: 'number' })
      .notNull(),
    notified70At: timestamp('notified_70_at'),
    notified85At: timestamp('notified_85_at'),
    notified100At: timestamp('notified_100_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex('organization_usage_organization_id_uidx').on(table.organizationId)]
);

const organizationUsageRelations = relations(organizationUsage, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationUsage.organizationId],
    references: [organization.id]
  })
}));

export { organizationUsage, organizationUsageRelations };
