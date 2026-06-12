import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp
} from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { user } from './user.schema.js';

const alertSignalType = pgEnum('alert_signal_type', [
  'error_rate',
  'latency_p95_ms',
  'latency_p99_ms',
  'apdex',
  'throughput_per_min',
  'availability_percent',
  'host_cpu_utilization',
  'host_memory_utilization',
  'host_filesystem_utilization',
  'host_reporting_stale',
  'container_cpu_utilization',
  'container_memory_utilization',
  'container_reporting_stale'
]);

const alertComparator = pgEnum('alert_comparator', ['gt', 'gte', 'lt', 'lte']);

const alertRule = pgTable(
  'alert_rule',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    signalType: alertSignalType('signal_type').notNull(),
    comparator: alertComparator('comparator').notNull(),
    threshold: real('threshold').notNull(),
    windowMinutes: integer('window_minutes').notNull(),
    renotifyMinutes: integer('renotify_minutes'),
    apdexTargetMs: integer('apdex_target_ms'),
    scopeServicesInclude: text('scope_services_include')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeServicesExclude: text('scope_services_exclude')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeSpanNamesInclude: text('scope_span_names_include')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeSpanNamesExclude: text('scope_span_names_exclude')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeEnvironmentsInclude: text('scope_environments_include')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeEnvironmentsExclude: text('scope_environments_exclude')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeScopesInclude: text('scope_scopes_include')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeScopesExclude: text('scope_scopes_exclude')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeHostNamesInclude: text('scope_host_names_include')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeHostNamesExclude: text('scope_host_names_exclude')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeContainerNamesInclude: text('scope_container_names_include')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    scopeContainerNamesExclude: text('scope_container_names_exclude')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    isEnabled: boolean('is_enabled').notNull().default(true),
    lastTriggeredAt: timestamp('last_triggered_at'),
    lastResolvedAt: timestamp('last_resolved_at'),
    nextEvaluationAt: timestamp('next_evaluation_at').defaultNow().notNull(),
    lastEvaluatedAt: timestamp('last_evaluated_at'),
    evaluationLeaseToken: text('evaluation_lease_token'),
    evaluationLeaseExpiresAt: timestamp('evaluation_lease_expires_at'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('alert_rule_app_id_idx').on(table.appId),
    index('alert_rule_next_evaluation_at_idx').on(table.nextEvaluationAt),
    index('alert_rule_enabled_next_evaluation_at_idx').on(table.isEnabled, table.nextEvaluationAt)
  ]
);

export { alertComparator, alertRule, alertSignalType };
