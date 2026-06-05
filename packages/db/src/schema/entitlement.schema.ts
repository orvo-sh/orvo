import { relations } from 'drizzle-orm';
import { bigint, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { organization } from './organization.schema.js';

const entitlement = pgTable(
  'entitlements',
  {
    organizationId: text('organization_id')
      .primaryKey()
      .references(() => organization.id, { onDelete: 'cascade' }),
    planKey: text('plan_key'),
    source: text('source').default('default').notNull(),
    logsRetentionDays: integer('logs_retention_days').default(30).notNull(),
    tracesRetentionDays: integer('traces_retention_days').default(14).notNull(),
    metricsRetentionDays: integer('metrics_retention_days').default(90).notNull(),
    logsMaxIngestBytesPerPeriod: bigint('logs_max_ingest_bytes_per_period', { mode: 'number' }),
    tracesMaxIngestBytesPerPeriod: bigint('traces_max_ingest_bytes_per_period', { mode: 'number' }),
    metricsMaxIngestBytesPerPeriod: bigint('metrics_max_ingest_bytes_per_period', {
      mode: 'number'
    }),
    maxIngestBytesMonthly: bigint('max_ingest_bytes_monthly', { mode: 'number' }),
    maxStoredBytes: bigint('max_stored_bytes', { mode: 'number' }),
    maxTelemetryEventsMonthly: bigint('max_telemetry_events_monthly', { mode: 'number' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [index('entitlements_plan_key_idx').on(table.planKey)]
);

const entitlementRelations = relations(entitlement, ({ one }) => ({
  organization: one(organization, {
    fields: [entitlement.organizationId],
    references: [organization.id]
  })
}));

export { entitlement, entitlementRelations };
