import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex
} from 'drizzle-orm/pg-core';

import { app } from './app.schema.js';
import { user } from './user.schema.js';

const incidentStatus = pgEnum('incident_status', ['open', 'resolved', 'dismissed']);
const incidentSourceType = pgEnum('incident_source_type', ['alert', 'heartbeat']);
const incidentSeverity = pgEnum('incident_severity', ['critical', 'warning', 'info']);
const incidentEntityType = pgEnum('incident_entity_type', ['app', 'container']);
const incidentType = pgEnum('incident_type', ['alert_threshold', 'heartbeat_missed']);
const incidentDismissReason = pgEnum('incident_dismiss_reason', [
  'expected',
  'false_positive',
  'not_actionable',
  'other'
]);

const incident = pgTable(
  'incident',
  {
    id: text('id').primaryKey(),
    appId: text('app_id')
      .notNull()
      .references(() => app.id, { onDelete: 'cascade' }),
    sourceType: incidentSourceType('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    sourceKey: text('source_key').notNull(),
    type: incidentType('type').notNull(),
    title: text('title').notNull(),
    severity: incidentSeverity('severity').notNull(),
    status: incidentStatus('status').notNull().default('open'),
    serviceName: text('service_name'),
    entityType: incidentEntityType('entity_type').notNull().default('app'),
    entityId: text('entity_id').notNull().default(''),
    entityName: text('entity_name'),
    sourceSnapshot: jsonb('source_snapshot')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    openedAt: timestamp('opened_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
    dismissedAt: timestamp('dismissed_at'),
    dismissedReason: incidentDismissReason('dismissed_reason'),
    dismissedReasonText: text('dismissed_reason_text'),
    dismissedBy: text('dismissed_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    lastObservedAt: timestamp('last_observed_at').defaultNow().notNull(),
    lastObservedValue: real('last_observed_value'),
    lastNotifiedAt: timestamp('last_notified_at'),
    renotifyCount: integer('renotify_count').notNull().default(0),
    suppressedUntilRecovered: boolean('suppressed_until_recovered')
      .notNull()
      .default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index('incident_app_id_idx').on(table.appId),
    index('incident_app_id_status_opened_at_idx').on(
      table.appId,
      table.status,
      table.openedAt,
    ),
    index('incident_source_type_source_id_idx').on(
      table.sourceType,
      table.sourceId,
    ),
    index('incident_entity_type_entity_id_idx').on(
      table.entityType,
      table.entityId,
    ),
    index('incident_source_key_idx').on(table.sourceKey),
    uniqueIndex('incident_one_open_per_source_key_uidx')
      .on(table.sourceKey)
      .where(sql`${table.status} = 'open'`)
  ],
);

export {
  incident,
  incidentDismissReason,
  incidentEntityType,
  incidentSeverity,
  incidentSourceType,
  incidentStatus,
  incidentType
};
